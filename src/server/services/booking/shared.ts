// Zajedničko za rezervacije: učitavanje usluga i radnika, raspored dana, dijelovi termina.
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { type Tx } from "../../db/client";
import {
  appointmentItems,
  appointmentSource,
  appointmentStatus,
  services,
  staff,
  staffServices,
  timeOff,
} from "../../db/schema";
import { isFree, type BusySegment, type Interval, type StaffDay } from "../../domain/availability";
import { addDays, dayBounds, toLocalDate, zonedToUtc, type LocalDate } from "../../domain/time";
import { DomainError } from "../../errors";
import type { Salon } from "../salons";
import { loadSchedules } from "../schedule";

export const MIN = 60_000;

/**
 * Ko zakazuje. `staff` = recepcija u dashboardu (smije van radnog vremena i
 * bez minimalnog razmaka); `public` = klijent sam, preko weba ili AI agenta.
 */
export type BookingMode = "staff" | "public";

export type Source = (typeof appointmentSource.enumValues)[number];
export type Status = (typeof appointmentStatus.enumValues)[number];

// ─── Učitavanje ──────────────────────────────────────────────────────────────

export async function loadServices(tx: Tx, salonId: string, serviceIds: string[], mode: BookingMode) {
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
export async function eligibleStaffIds(tx: Tx, salonId: string, serviceIds: string[], mode: BookingMode, only?: string) {
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
export async function loadStaffDays(
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
export function totalBlockMin(list: { durationMin: number; bufferMin: number }[]) {
  return list.reduce((sum, s) => sum + s.durationMin + s.bufferMin, 0);
}

export type TimedService = { durationMin: number; bufferMin: number; gapStartMin: number; gapMin: number };

/**
 * Dijelovi u kojima je radnik zauzet, u minutama od početka termina. Vrijeme
 * djelovanja (npr. boja) je rupa između dijelova — tada radnik može raditi drugog klijenta.
 */
export function busySegments(list: TimedService[]): BusySegment[] {
  const segs: BusySegment[] = [];
  let cursor = 0;
  const push = (offsetMin: number, durationMin: number) => {
    const last = segs[segs.length - 1];
    if (last && last.offsetMin + last.durationMin === offsetMin) last.durationMin += durationMin;
    else segs.push({ offsetMin, durationMin });
  };
  for (const s of list) {
    if (s.gapMin > 0) {
      push(cursor, s.gapStartMin);
      push(cursor + s.gapStartMin + s.gapMin, s.durationMin - s.gapStartMin - s.gapMin + s.bufferMin);
    } else {
      push(cursor, s.durationMin + s.bufferMin);
    }
    cursor += s.durationMin + s.bufferMin;
  }
  return segs;
}

export function segmentIntervals(list: TimedService[], start: number): Interval[] {
  return busySegments(list).map((g) => ({ start: start + g.offsetMin * MIN, end: start + (g.offsetMin + g.durationMin) * MIN }));
}

/** Radnik je slobodan u svim dijelovima termina. */
export function allFree(day: StaffDay, intervals: Interval[]) {
  return intervals.every((i) => isFree(day, i));
}

export function bookingWindow(salon: Salon, mode: BookingMode, now: Date) {
  if (mode === "staff") return { earliest: undefined, lastDate: undefined };
  return {
    earliest: now.getTime() + salon.minLeadMin * MIN,
    lastDate: addDays(toLocalDate(now, salon.timezone), salon.maxAdvanceDays),
  };
}
