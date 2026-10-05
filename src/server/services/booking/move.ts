// Premještanje termina na drugo vrijeme ili drugog radnika (prevlačenje, konflikti).
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client";
import { appointmentItems, appointments } from "../../db/schema";
import { toLocalDate } from "../../domain/time";
import { DomainError, isExclusionViolation } from "../../errors";
import type { Salon } from "../salons";
import { allFree, eligibleStaffIds, loadStaffDays } from "./shared";

// ─── Premještanje termina ────────────────────────────────────────────────────

export async function loadBlock(salonId: string, appointmentId: string, staffId: string) {
  const rows = await db
    .select({ item: appointmentItems, status: appointments.status })
    .from(appointmentItems)
    .innerJoin(appointments, eq(appointments.id, appointmentItems.appointmentId))
    .where(
      and(
        eq(appointmentItems.salonId, salonId),
        eq(appointmentItems.appointmentId, appointmentId),
        eq(appointmentItems.staffId, staffId),
      ),
    )
    .orderBy(asc(appointmentItems.startsAt));
  if (!rows.length) throw new DomainError("NOT_FOUND", "Termin ne postoji.");
  if (rows[0].status === "cancelled") throw new DomainError("INVALID_INPUT", "Otkazani termin se ne može premjestiti.");
  return rows.map((r) => r.item);
}

/** Radnici koji rade te usluge i slobodni su u istom terminu (prijedlog za prebacivanje). */
export async function suggestReassignment(salon: Salon, appointmentId: string, fromStaffId: string): Promise<string[]> {
  const items = await loadBlock(salon.id, appointmentId, fromStaffId);
  const serviceIds = [...new Set(items.map((i) => i.serviceId))];
  const candidates = (await eligibleStaffIds(db, salon.id, serviceIds, "staff")).filter((id) => id !== fromStaffId);
  if (!candidates.length) return [];
  const intervals = items.map((i) => ({ start: i.startsAt.getTime(), end: i.blockedUntil.getTime() }));
  const date = toLocalDate(items[0].startsAt, salon.timezone);
  const days = await loadStaffDays(db, salon, candidates, date, 1, appointmentId);
  return (days.get(date) ?? []).filter((d) => allFree(d, intervals)).map((d) => d.staffId);
}

export const moveAppointmentInput = z.object({
  appointmentId: z.uuid(),
  /** Radnik čiji blok pomjeramo (posjeta može imati više radnika). */
  fromStaffId: z.uuid(),
  toStaffId: z.uuid(),
  /** Novi početak bloka; bez njega ostaje isto vrijeme (samo promjena radnika). */
  startsAt: z.coerce.date().optional(),
});

/**
 * Pomjera blok termina na drugog radnika i/ili drugo vrijeme.
 * Trajanja usluga ostaju ista; preklapanje odbija baza.
 */
export async function moveAppointment(salon: Salon, raw: z.input<typeof moveAppointmentInput>) {
  const input = moveAppointmentInput.parse(raw);
  const items = await loadBlock(salon.id, input.appointmentId, input.fromStaffId);

  if (input.toStaffId !== input.fromStaffId) {
    const serviceIds = [...new Set(items.map((i) => i.serviceId))];
    const ok = await eligibleStaffIds(db, salon.id, serviceIds, "staff", input.toStaffId);
    if (!ok.length) throw new DomainError("STAFF_CANT_DO_SERVICE", "Taj radnik ne radi ovu uslugu.");
  }
  const delta = input.startsAt ? input.startsAt.getTime() - items[0].startsAt.getTime() : 0;
  const shift = (d: Date) => new Date(d.getTime() + delta);

  try {
    await db.transaction(async (tx) => {
      // Prvo isključi stare stavke, da se pri pomjeranju ne sudare same sa sobom
      await tx
        .update(appointmentItems)
        .set({ active: false })
        .where(inArray(appointmentItems.id, items.map((i) => i.id)));
      for (const i of items) {
        await tx
          .update(appointmentItems)
          .set({
            staffId: input.toStaffId,
            startsAt: shift(i.startsAt),
            endsAt: shift(i.endsAt),
            blockedUntil: shift(i.blockedUntil),
            active: true,
          })
          .where(eq(appointmentItems.id, i.id));
      }
      // Početak i kraj posjete prate sve njene stavke
      const all = await tx
        .select({ startsAt: appointmentItems.startsAt, endsAt: appointmentItems.endsAt })
        .from(appointmentItems)
        .where(eq(appointmentItems.appointmentId, input.appointmentId));
      await tx
        .update(appointments)
        .set({
          startsAt: new Date(Math.min(...all.map((a) => a.startsAt.getTime()))),
          endsAt: new Date(Math.max(...all.map((a) => a.endsAt.getTime()))),
        })
        .where(eq(appointments.id, input.appointmentId));
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw new DomainError("SLOT_TAKEN", "Radnik je zauzet u to vrijeme.");
    throw err;
  }
}
