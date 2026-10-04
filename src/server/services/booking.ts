// Rezervacije: slobodni termini, kreiranje, otkazivanje, promjena statusa.
// Ovo je jedini ulaz za zakazivanje — dashboard, javna stranica i AI agent
// zovu iste funkcije, pa sva pravila važe jednako za sve kanale.
import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "../db/client";
import {
  appointmentItems,
  appointments,
  appointmentSource,
  appointmentStatus,
  clients,
  services,
  staff,
  staffServices,
  timeOff,
} from "../db/schema";
import { findSlots, isFree, type Interval, type StaffDay } from "../domain/availability";
import { addDays, dayBounds, isLocalDate, toLocalDate, toLocalMinutes, zonedToUtc, type LocalDate } from "../domain/time";
import { normalizePhone } from "@/lib/phone";
import { DomainError, isExclusionViolation } from "../errors";
import { clientInput, findOrCreateClient } from "./clients";
import type { Salon } from "./salons";
import { loadSchedules } from "./schedule";

const MIN = 60_000;

/**
 * Ko zakazuje. `staff` = recepcija u dashboardu (smije van radnog vremena i
 * bez minimalnog razmaka); `public` = klijent sam, preko weba ili AI agenta.
 */
export type BookingMode = "staff" | "public";

export type Source = (typeof appointmentSource.enumValues)[number];
export type Status = (typeof appointmentStatus.enumValues)[number];

// ─── Učitavanje ──────────────────────────────────────────────────────────────

async function loadServices(tx: Tx, salonId: string, serviceIds: string[], mode: BookingMode) {
  if (!serviceIds.length) throw new DomainError("INVALID_INPUT", "Odaberite bar jednu uslugu.");
  const rows = await tx
    .select()
    .from(services)
    .where(and(eq(services.salonId, salonId), inArray(services.id, serviceIds), eq(services.active, true)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = serviceIds.map((id) => byId.get(id));
  if (ordered.some((s) => !s)) throw new DomainError("NOT_FOUND", "Usluga nije dostupna.");
  const list = ordered as (typeof services.$inferSelect)[];
  if (mode === "public" && list.some((s) => !s.bookableOnline)) {
    throw new DomainError("INVALID_INPUT", "Ova usluga se zakazuje samo telefonom.");
  }
  return list;
}

/** Radnici koji rade SVE tražene usluge. */
async function eligibleStaffIds(tx: Tx, salonId: string, serviceIds: string[], mode: BookingMode, only?: string) {
  const conds = [eq(staff.salonId, salonId), eq(staff.active, true), inArray(staffServices.serviceId, serviceIds)];
  if (mode === "public") conds.push(eq(staff.bookableOnline, true));
  if (only) conds.push(eq(staff.id, only));
  const rows = await tx
    .select({ id: staff.id, serviceId: staffServices.serviceId, sort: staff.sortOrder })
    .from(staff)
    .innerJoin(staffServices, eq(staffServices.staffId, staff.id))
    .where(and(...conds))
    .orderBy(asc(staff.sortOrder), asc(staff.createdAt));

  const need = new Set(serviceIds);
  const counts = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!counts.has(r.id)) counts.set(r.id, new Set());
    counts.get(r.id)!.add(r.serviceId);
  }
  return [...counts.entries()].filter(([, s]) => s.size === need.size).map(([id]) => id);
}

/** Smjene i zauzetost radnika za niz dana — jedan upit po tabeli. */
async function loadStaffDays(
  tx: Tx,
  salon: Salon,
  staffIds: string[],
  from: LocalDate,
  days: number,
  ignoreAppointmentId?: string,
): Promise<Map<LocalDate, StaffDay[]>> {
  const result = new Map<LocalDate, StaffDay[]>();
  if (!staffIds.length) return result;

  const rangeStart = dayBounds(from, salon.timezone).start;
  const rangeEnd = dayBounds(addDays(from, days - 1), salon.timezone).end;

  const [schedules, items, absences] = await Promise.all([
    loadSchedules(tx, staffIds, from, days),
    tx
      .select({
        staffId: appointmentItems.staffId,
        start: appointmentItems.startsAt,
        end: appointmentItems.blockedUntil,
        appointmentId: appointmentItems.appointmentId,
      })
      .from(appointmentItems)
      .where(
        and(
          inArray(appointmentItems.staffId, staffIds),
          eq(appointmentItems.active, true),
          lt(appointmentItems.startsAt, rangeEnd),
          gt(appointmentItems.blockedUntil, rangeStart),
        ),
      ),
    tx
      .select({ staffId: timeOff.staffId, start: timeOff.startsAt, end: timeOff.endsAt })
      .from(timeOff)
      .where(and(inArray(timeOff.staffId, staffIds), lt(timeOff.startsAt, rangeEnd), gt(timeOff.endsAt, rangeStart))),
  ]);

  const busyByStaff = new Map<string, Interval[]>();
  for (const b of [...items.filter((i) => i.appointmentId !== ignoreAppointmentId), ...absences]) {
    const list = busyByStaff.get(b.staffId) ?? [];
    list.push({ start: b.start.getTime(), end: b.end.getTime() });
    busyByStaff.set(b.staffId, list);
  }

  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    result.set(
      date,
      staffIds.map((staffId) => ({
        staffId,
        shifts: (schedules.get(staffId)?.get(date)?.shifts ?? []).map((h) => ({
            start: zonedToUtc(date, h.startMin, salon.timezone).getTime(),
            end: zonedToUtc(date, h.endMin, salon.timezone).getTime(),
          })),
        busy: busyByStaff.get(staffId) ?? [],
      })),
    );
  }
  return result;
}

/** Ukupno blokirano vrijeme za niz usluga (trajanje + buffer svake). */
function totalBlockMin(list: { durationMin: number; bufferMin: number }[]) {
  return list.reduce((sum, s) => sum + s.durationMin + s.bufferMin, 0);
}

function bookingWindow(salon: Salon, mode: BookingMode, now: Date) {
  if (mode === "staff") return { earliest: undefined, lastDate: undefined };
  return {
    earliest: now.getTime() + salon.minLeadMin * MIN,
    lastDate: addDays(toLocalDate(now, salon.timezone), salon.maxAdvanceDays),
  };
}

// ─── Slobodni termini ────────────────────────────────────────────────────────

export const availabilityQuery = z.object({
  serviceIds: z.array(z.uuid()).min(1),
  /** Konkretan radnik ili bilo ko slobodan. */
  staffId: z.uuid().optional(),
  from: z.string().refine(isLocalDate, "Neispravan datum."),
  days: z.number().int().min(1).max(31).default(1),
});

export interface DayAvailability {
  date: LocalDate;
  slots: { start: string; staffIds: string[] }[];
}

export async function getAvailability(
  salon: Salon,
  raw: z.input<typeof availabilityQuery>,
  opts: { mode: BookingMode; now?: Date },
): Promise<DayAvailability[]> {
  const q = availabilityQuery.parse(raw);
  const now = opts.now ?? new Date();
  const list = await loadServices(db, salon.id, q.serviceIds, opts.mode);
  const staffIds = await eligibleStaffIds(db, salon.id, q.serviceIds, opts.mode, q.staffId);
  const { earliest, lastDate } = bookingWindow(salon, opts.mode, now);

  const days = await loadStaffDays(db, salon, staffIds, q.from, q.days);
  const duration = totalBlockMin(list);

  return [...days.entries()].map(([date, staffDays]) => {
    if (lastDate && date > lastDate) return { date, slots: [] };
    const slots = findSlots({
      staff: staffDays,
      durationMin: duration,
      stepMin: salon.slotIntervalMin,
      gridOrigin: dayBounds(date, salon.timezone).start.getTime(),
      earliest,
    });
    return {
      date,
      slots: slots.map((s) => ({ start: new Date(s.start).toISOString(), staffIds: s.staffIds })),
    };
  });
}

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
  const blockEnd = start + totalBlockMin(list) * MIN;
  const { earliest, lastDate } = bookingWindow(salon, opts.mode, now);
  const date = toLocalDate(input.startsAt, salon.timezone);
  if (earliest !== undefined && start < earliest) {
    throw new DomainError("TOO_EARLY", "Taj termin je prekasno za online zakazivanje. Odaberite kasniji.");
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
      staffDays.filter((d) => d.staffId === id).some((d) => isFree(d, { start, end: blockEnd })),
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

        let cursor = start;
        const items = list.map((s) => {
          const itemStart = cursor;
          const itemEnd = itemStart + s.durationMin * MIN;
          const blockedUntil = itemEnd + s.bufferMin * MIN;
          cursor = blockedUntil;
          return {
            salonId: salon.id,
            staffId,
            serviceId: s.id,
            serviceName: s.name,
            priceCents: s.priceCents,
            startsAt: new Date(itemStart),
            endsAt: new Date(itemEnd),
            blockedUntil: new Date(blockedUntil),
          };
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

// ─── Izmjene ─────────────────────────────────────────────────────────────────

export async function setAppointmentStatus(
  salonId: string,
  appointmentId: string,
  status: Status,
  opts: { reason?: string } = {},
) {
  await db.transaction(async (tx) => {
    const cancelled = status === "cancelled";
    const updated = await tx
      .update(appointments)
      .set({
        status,
        cancelledAt: cancelled ? new Date() : null,
        cancelReason: cancelled ? (opts.reason ?? null) : null,
      })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.salonId, salonId)))
      .returning({ id: appointments.id });
    if (!updated.length) throw new DomainError("NOT_FOUND", "Termin ne postoji.");
    try {
      await tx
        .update(appointmentItems)
        .set({ active: !cancelled })
        .where(eq(appointmentItems.appointmentId, appointmentId));
    } catch (err) {
      // Vraćanje otkazanog termina koji je u međuvremenu neko drugi zauzeo
      if (isExclusionViolation(err)) {
        throw new DomainError("SLOT_TAKEN", "Termin je u međuvremenu zauzet, ne može se vratiti.");
      }
      throw err;
    }
  });
}

// ─── Pregled ─────────────────────────────────────────────────────────────────

export interface CalendarItem {
  itemId: string;
  appointmentId: string;
  staffId: string;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  startsAt: Date;
  endsAt: Date;
  blockedUntil: Date;
  status: Status;
  /** Prva posjeta ovog klijenta u salonu */
  firstVisit: boolean;
  source: Source;
  notes: string | null;
  client: { id: string; name: string; phone: string | null } | null;
}

export async function listCalendar(salonId: string, from: Date, to: Date): Promise<CalendarItem[]> {
  const rows = await db
    .select({
      itemId: appointmentItems.id,
      appointmentId: appointmentItems.appointmentId,
      staffId: appointmentItems.staffId,
      serviceId: appointmentItems.serviceId,
      serviceName: appointmentItems.serviceName,
      priceCents: appointmentItems.priceCents,
      startsAt: appointmentItems.startsAt,
      endsAt: appointmentItems.endsAt,
      blockedUntil: appointmentItems.blockedUntil,
      status: appointments.status,
      firstVisit: sql<boolean>`not exists (
        select 1 from ${appointments} prev
        where prev.client_id = ${appointments.clientId}
          and prev.starts_at < ${appointments.startsAt}
          and prev.status <> 'cancelled'
      )`,
      source: appointments.source,
      notes: appointments.notes,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(appointmentItems)
    .innerJoin(appointments, eq(appointments.id, appointmentItems.appointmentId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(eq(appointmentItems.salonId, salonId), lt(appointmentItems.startsAt, to), gt(appointmentItems.endsAt, from)),
    )
    .orderBy(asc(appointmentItems.startsAt));

  return rows.map(({ clientId, clientName, clientPhone, ...r }) => ({
    ...r,
    client: clientId ? { id: clientId, name: clientName!, phone: clientPhone } : null,
  }));
}

// ─── Termini klijenta (za AI recepcionera) ───────────────────────────────────

export interface ClientAppointment {
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  status: Status;
  services: string[];
  staffIds: string[];
}

/** Budući termini klijenta s tim brojem telefona. */
export async function listUpcomingByPhone(salonId: string, phoneInput: string, now = new Date()): Promise<ClientAppointment[]> {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw new DomainError("INVALID_INPUT", "Broj telefona nije ispravan.");
  const rows = await db
    .select({
      appointmentId: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      serviceName: appointmentItems.serviceName,
      staffId: appointmentItems.staffId,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(appointmentItems, eq(appointmentItems.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.salonId, salonId),
        eq(clients.phone, phone),
        gt(appointments.startsAt, now),
        inArray(appointments.status, ["booked", "confirmed"]),
      ),
    )
    .orderBy(asc(appointments.startsAt), asc(appointmentItems.startsAt));

  const byId = new Map<string, ClientAppointment>();
  for (const r of rows) {
    const a = byId.get(r.appointmentId) ?? {
      appointmentId: r.appointmentId, startsAt: r.startsAt, endsAt: r.endsAt, status: r.status, services: [], staffIds: [],
    };
    a.services.push(r.serviceName);
    if (!a.staffIds.includes(r.staffId)) a.staffIds.push(r.staffId);
    byId.set(r.appointmentId, a);
  }
  return [...byId.values()];
}

/** Otkazivanje od strane klijenta: termin mora pripadati tom broju telefona. */
export async function cancelByClient(salonId: string, appointmentId: string, phoneInput: string, reason?: string) {
  const own = await listUpcomingByPhone(salonId, phoneInput);
  if (!own.some((a) => a.appointmentId === appointmentId)) {
    throw new DomainError("NOT_FOUND", "Nema budućeg termina s tim brojem telefona.");
  }
  await setAppointmentStatus(salonId, appointmentId, "cancelled", { reason: reason ?? "Otkazao klijent" });
}

// ─── Konflikti s rasporedom ──────────────────────────────────────────────────

export interface ScheduleConflict {
  appointmentId: string;
  staffId: string;
  date: LocalDate;
  startMin: number;
  endMin: number;
  services: string[];
  serviceIds: string[];
  client: { name: string; phone: string | null } | null;
  reason: "day_off" | "outside_hours" | "time_off";
}

/**
 * Budući termini koji više ne padaju u radno vrijeme radnika — npr. nakon izmjene
 * smjene, slobodnog dana ili odsustva. Ništa se ne briše automatski; recepcija
 * ih rješava (prebaci, pomjeri, otkaži).
 */
export async function listScheduleConflicts(
  salon: Salon,
  opts: { from: LocalDate; days: number; staffId?: string; now?: Date },
): Promise<ScheduleConflict[]> {
  const now = opts.now ?? new Date();
  const rangeStart = new Date(Math.max(dayBounds(opts.from, salon.timezone).start.getTime(), now.getTime()));
  const rangeEnd = dayBounds(addDays(opts.from, opts.days - 1), salon.timezone).end;

  const conds = [
    eq(appointmentItems.salonId, salon.id),
    eq(appointmentItems.active, true),
    inArray(appointments.status, ["booked", "confirmed"]),
    gt(appointmentItems.startsAt, rangeStart),
    lt(appointmentItems.startsAt, rangeEnd),
  ];
  if (opts.staffId) conds.push(eq(appointmentItems.staffId, opts.staffId));

  const items = await db
    .select({
      appointmentId: appointmentItems.appointmentId,
      staffId: appointmentItems.staffId,
      serviceId: appointmentItems.serviceId,
      serviceName: appointmentItems.serviceName,
      startsAt: appointmentItems.startsAt,
      endsAt: appointmentItems.endsAt,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(appointmentItems)
    .innerJoin(appointments, eq(appointments.id, appointmentItems.appointmentId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(and(...conds))
    .orderBy(asc(appointmentItems.startsAt));
  if (!items.length) return [];

  const staffIds = [...new Set(items.map((i) => i.staffId))];
  const [schedules, absences] = await Promise.all([
    loadSchedules(db, staffIds, opts.from, opts.days),
    db
      .select({ staffId: timeOff.staffId, start: timeOff.startsAt, end: timeOff.endsAt })
      .from(timeOff)
      .where(and(inArray(timeOff.staffId, staffIds), lt(timeOff.startsAt, rangeEnd), gt(timeOff.endsAt, rangeStart))),
  ]);

  // Spoji stavke iste posjete kod istog radnika u jedan blok
  const blocks = new Map<string, ScheduleConflict & { start: Date; end: Date }>();
  for (const i of items) {
    const key = `${i.appointmentId}:${i.staffId}`;
    const b = blocks.get(key);
    if (b) {
      if (i.endsAt > b.end) b.end = i.endsAt;
      b.services.push(i.serviceName);
      b.serviceIds.push(i.serviceId);
      continue;
    }
    blocks.set(key, {
      appointmentId: i.appointmentId,
      staffId: i.staffId,
      date: toLocalDate(i.startsAt, salon.timezone),
      startMin: 0,
      endMin: 0,
      services: [i.serviceName],
      serviceIds: [i.serviceId],
      client: i.clientName ? { name: i.clientName, phone: i.clientPhone } : null,
      reason: "outside_hours",
      start: i.startsAt,
      end: i.endsAt,
    });
  }

  const conflicts: ScheduleConflict[] = [];
  for (const { start, end, ...b } of blocks.values()) {
    b.startMin = toLocalMinutes(start, salon.timezone);
    b.endMin = toLocalDate(end, salon.timezone) === b.date ? toLocalMinutes(end, salon.timezone) : 24 * 60;
    const shifts = schedules.get(b.staffId)?.get(b.date)?.shifts ?? [];
    const absent = absences.some((a) => a.staffId === b.staffId && a.start < end && a.end > start);
    if (absent) conflicts.push({ ...b, reason: "time_off" });
    else if (!shifts.length) conflicts.push({ ...b, reason: "day_off" });
    else if (!shifts.some((s) => s.startMin <= b.startMin && b.endMin <= s.endMin)) conflicts.push({ ...b, reason: "outside_hours" });
  }
  return conflicts;
}

// ─── Premještanje termina ────────────────────────────────────────────────────

async function loadBlock(salonId: string, appointmentId: string, staffId: string) {
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
  const start = items[0].startsAt.getTime();
  const end = Math.max(...items.map((i) => i.blockedUntil.getTime()));
  const date = toLocalDate(items[0].startsAt, salon.timezone);
  const days = await loadStaffDays(db, salon, candidates, date, 1, appointmentId);
  return (days.get(date) ?? []).filter((d) => isFree(d, { start, end })).map((d) => d.staffId);
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

// ─── Pomjeranje termina na zahtjev klijenta (AI recepcioner) ────────────────

/**
 * Klijent pomjera svoj termin: isti broj telefona, nova pravila kao za online
 * zakazivanje (radno vrijeme, minimalni razmak, slobodan radnik). Termin se
 * premješta — ne pravi se novi, pa nema duplih rezervacija.
 */
export async function rescheduleByClient(
  salon: Salon,
  input: { appointmentId: string; phone: string; startsAt: Date; staffId?: string },
  opts: { now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const own = await listUpcomingByPhone(salon.id, input.phone, now);
  const appt = own.find((a) => a.appointmentId === input.appointmentId);
  if (!appt) throw new DomainError("NOT_FOUND", "Nema budućeg termina s tim brojem telefona.");
  if (appt.staffIds.length !== 1) {
    throw new DomainError("INVALID_INPUT", "Ovaj termin ima više radnika — pomjeranje dogovorite sa salonom.");
  }
  const fromStaffId = appt.staffIds[0];
  const items = await loadBlock(salon.id, input.appointmentId, fromStaffId);
  const serviceIds = [...new Set(items.map((i) => i.serviceId))];
  const list = await loadServices(db, salon.id, serviceIds, "public");

  const start = input.startsAt.getTime();
  const end = start + totalBlockMin(list) * MIN;
  const { earliest, lastDate } = bookingWindow(salon, "public", now);
  const date = toLocalDate(input.startsAt, salon.timezone);
  if (earliest !== undefined && start < earliest) {
    throw new DomainError("TOO_EARLY", "Taj termin je prekasno za online promjenu. Odaberite kasniji.");
  }
  if (lastDate && date > lastDate) {
    throw new DomainError("TOO_FAR", `Termine je moguće zakazati najviše ${salon.maxAdvanceDays} dana unaprijed.`);
  }

  const candidates = await eligibleStaffIds(db, salon.id, serviceIds, "public", input.staffId);
  // Postojeći radnik ima prednost, pa ostali redom
  const ordered = [fromStaffId, ...candidates.filter((id) => id !== fromStaffId)].filter((id) => candidates.includes(id));
  if (!ordered.length) throw new DomainError("STAFF_CANT_DO_SERVICE", "Taj radnik ne radi ovu uslugu.");

  const days = await loadStaffDays(db, salon, ordered, date, 2, input.appointmentId);
  const staffDays = [...(days.get(date) ?? []), ...(days.get(addDays(date, 1)) ?? [])];
  const free = ordered.filter((id) => staffDays.filter((d) => d.staffId === id).some((d) => isFree(d, { start, end })));
  if (!free.length) throw new DomainError("SLOT_TAKEN", "Taj termin nije slobodan. Odaberite drugi.");

  await moveAppointment(salon, { appointmentId: input.appointmentId, fromStaffId, toStaffId: free[0], startsAt: input.startsAt });
  return { staffId: free[0], startsAt: input.startsAt, endsAt: new Date(start + (items.at(-1)!.endsAt.getTime() - items[0].startsAt.getTime())) };
}
