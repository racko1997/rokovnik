// Termini koji su nakon promjene rasporeda ostali van radnog vremena.
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "../../db/client";
import { appointmentItems, appointments, clients, timeOff } from "../../db/schema";
import { addDays, dayBounds, toLocalDate, toLocalMinutes, type LocalDate } from "../../domain/time";
import type { Salon } from "../salons";
import { loadSchedules } from "../schedule";

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
      // Nastavak iste usluge (nakon djelovanja) se ne ponavlja u nazivu
      if (!b.serviceIds.includes(i.serviceId)) {
        b.services.push(i.serviceName);
        b.serviceIds.push(i.serviceId);
      }
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
