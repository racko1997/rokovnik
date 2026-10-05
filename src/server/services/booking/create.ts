// Upis novog termina. Preklapanje kod istog radnika odbija sama baza.
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "../../db/client";
import { appointmentItems, appointments, appointmentSource, clients } from "../../db/schema";
import { addDays, toLocalDate } from "../../domain/time";
import { DomainError, isExclusionViolation } from "../../errors";
import { clientInput, findOrCreateClient } from "../clients";
import type { Salon } from "../salons";
import {
  allFree,
  bookingWindow,
  eligibleStaffIds,
  loadServices,
  loadStaffDays,
  MIN,
  segmentIntervals,
  type BookingMode,
} from "./shared";

// ─── Kreiranje ───────────────────────────────────────────────────────────────

export const createAppointmentInput = z.object({
  serviceIds: z.array(z.uuid()).min(1, "Odaberite bar jednu uslugu."),
  /** Bez radnika = prvi slobodan. */
  staffId: z.uuid().optional(),
  startsAt: z.coerce.date(),
  clientId: z.uuid().optional(),
  client: clientInput.optional(),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
  source: z.enum(appointmentSource.enumValues).default("dashboard"),
  conversationId: z.uuid().optional(),
  /** Recepcija naknadno upisuje posjetu koja je već bila (npr. klijent bez najave) */
  allowPast: z.boolean().default(false),
});

export async function createAppointment(
  salon: Salon,
  raw: z.input<typeof createAppointmentInput>,
  opts: { mode: BookingMode; userId?: string; now?: Date },
): Promise<{ appointmentId: string; clientId: string; staffId: string; startsAt: Date; endsAt: Date }> {
  const input = createAppointmentInput.parse(raw);
  const now = opts.now ?? new Date();
  if (!input.clientId && !input.client) throw new DomainError("INVALID_INPUT", "Unesite podatke o klijentu.");

  const list = await loadServices(db, salon.id, input.serviceIds, opts.mode);
  const candidates = await eligibleStaffIds(db, salon.id, input.serviceIds, opts.mode, input.staffId);
  if (!candidates.length) {
    throw new DomainError("STAFF_CANT_DO_SERVICE", input.staffId
      ? "Odabrani radnik ne radi ovu uslugu."
      : "Nijedan radnik trenutno ne radi ovu uslugu.");
  }

  const start = input.startsAt.getTime();
  const { earliest, lastDate } = bookingWindow(salon, opts.mode, now);
  const date = toLocalDate(input.startsAt, salon.timezone);
  if (opts.mode === "public" && earliest !== undefined && start < earliest) {
    throw new DomainError("TOO_EARLY", "Taj termin je prekasno za online zakazivanje. Odaberite kasniji.");
  }
  // Termin u prošlosti (uz 5 min tolerancije) recepcija upisuje samo uz izričitu potvrdu
  if (opts.mode === "staff" && start < now.getTime() - 5 * MIN && !input.allowPast) {
    throw new DomainError("IN_PAST", "Ovaj termin je već prošao. Ako upisujete posjetu naknadno, potvrdite upis u prošlosti.");
  }
  if (lastDate && date > lastDate) {
    throw new DomainError("TOO_FAR", `Termine je moguće zakazati najviše ${salon.maxAdvanceDays} dana unaprijed.`);
  }

  // Za klijente: termin mora biti u radnom vremenu i slobodan.
  // Za recepciju: dozvoljen je i prekovremeni termin; preklapanje svakako blokira baza.
  let ordered = candidates;
  if (opts.mode === "public") {
    const days = await loadStaffDays(db, salon, candidates, date, 2);
    const staffDays = [...(days.get(date) ?? []), ...(days.get(addDays(date, 1)) ?? [])];
    ordered = candidates.filter((id) =>
      staffDays.filter((d) => d.staffId === id).some((d) => allFree(d, segmentIntervals(list, start))),
    );
    if (!ordered.length) throw new DomainError("SLOT_TAKEN", "Taj termin više nije slobodan. Odaberite drugi.");
  }

  // Ako je "bilo ko", probamo redom — neko drugi je možda upravo uzeo termin.
  for (const staffId of ordered) {
    try {
      return await db.transaction(async (tx) => {
        const clientId = input.clientId
          ? await assertClient(tx, salon.id, input.clientId)
          : (await findOrCreateClient(tx, salon.id, input.client!)).id;

        // Usluga s vremenom djelovanja se upisuje u dva dijela (prije i poslije rupe),
        // pa je radnik u rupi slobodan i baza dozvoljava drugi termin u tom vremenu.
        let cursor = start;
        const items = list.flatMap((s) => {
          const base = { salonId: salon.id, staffId, serviceId: s.id, serviceName: s.name };
          const itemStart = cursor;
          const itemEnd = itemStart + s.durationMin * MIN;
          cursor = itemEnd + s.bufferMin * MIN;
          if (s.gapMin > 0) {
            const gapStart = itemStart + s.gapStartMin * MIN;
            const gapEnd = gapStart + s.gapMin * MIN;
            return [
              { ...base, priceCents: s.priceCents, part: 0, startsAt: new Date(itemStart), endsAt: new Date(gapStart), blockedUntil: new Date(gapStart) },
              { ...base, priceCents: 0, part: 1, startsAt: new Date(gapEnd), endsAt: new Date(itemEnd), blockedUntil: new Date(cursor) },
            ];
          }
          return [
            { ...base, priceCents: s.priceCents, part: 0, startsAt: new Date(itemStart), endsAt: new Date(itemEnd), blockedUntil: new Date(cursor) },
          ];
        });
        const endsAt = items[items.length - 1].endsAt;

        const [appt] = await tx
          .insert(appointments)
          .values({
            salonId: salon.id,
            clientId,
            source: input.source,
            startsAt: input.startsAt,
            endsAt,
            notes: input.notes,
            createdByUserId: opts.userId ?? null,
            conversationId: input.conversationId ?? null,
          })
          .returning({ id: appointments.id });
        await tx.insert(appointmentItems).values(items.map((i) => ({ ...i, appointmentId: appt.id })));
        return { appointmentId: appt.id, clientId, staffId, startsAt: input.startsAt, endsAt };
      });
    } catch (err) {
      if (!isExclusionViolation(err)) throw err;
    }
  }
  throw new DomainError("SLOT_TAKEN", "Radnik je zauzet u to vrijeme. Odaberite drugi termin.");
}

async function assertClient(tx: Tx, salonId: string, clientId: string) {
  const row = await tx.query.clients.findFirst({ where: and(eq(clients.id, clientId), eq(clients.salonId, salonId)) });
  if (!row) throw new DomainError("NOT_FOUND", "Klijent ne postoji.");
  return row.id;
}
