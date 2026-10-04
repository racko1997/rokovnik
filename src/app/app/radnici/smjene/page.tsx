import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireSalon } from "@/server/context";
import { db } from "@/server/db/client";
import { addDays, dayBounds, isLocalDate, isoWeekday, toLocalDate, toLocalMinutes } from "@/server/domain/time";
import { listCalendar, listScheduleConflicts } from "@/server/services/booking";
import { loadSchedules } from "@/server/services/schedule";
import { listStaff, listTimeOff } from "@/server/services/staff";
import { ShiftsBoard, type WeekCell } from "./shifts-board";
import { withSuggestions } from "./suggestions";

export const metadata: Metadata = { title: "Smjene" };

/** Koliko dana unaprijed tražimo termine koje treba riješiti. */
const CONFLICT_HORIZON_DAYS = 90;

export default async function ShiftsPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { salon } = await requireSalon();
  const tz = salon.timezone;
  const today = toLocalDate(new Date(), tz);
  const { w } = await searchParams;
  const anchor = w && isLocalDate(w) ? w : today;
  const weekStart = addDays(anchor, 1 - isoWeekday(anchor));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const range = { start: dayBounds(weekStart, tz).start, end: dayBounds(days[6], tz).end };

  const staff = await listStaff(salon.id);
  const staffIds = staff.map((s) => s.id);
  const [schedules, absences, items, conflicts] = await Promise.all([
    loadSchedules(db, staffIds, weekStart, 7),
    listTimeOff(salon.id, range.start, range.end),
    listCalendar(salon.id, range.start, range.end),
    listScheduleConflicts(salon, { from: today, days: CONFLICT_HORIZON_DAYS }).then((c) => withSuggestions(salon, c)),
  ]);

  const cells: WeekCell[] = staff.flatMap((s) =>
    days.map((date) => {
      const sched = schedules.get(s.id)?.get(date);
      const { start, end } = dayBounds(date, tz);
      const dayItems = items.filter((i) => i.staffId === s.id && i.status !== "cancelled" && toLocalDate(i.startsAt, tz) === date);
      // Spoji stavke iste posjete
      const visits = new Map<string, { startMin: number; endMin: number; client: string; services: string[] }>();
      for (const i of dayItems) {
        const v = visits.get(i.appointmentId);
        const endMin = toLocalMinutes(i.endsAt, tz);
        if (v) {
          v.endMin = Math.max(v.endMin, endMin);
          v.services.push(i.serviceName);
        } else {
          visits.set(i.appointmentId, { startMin: toLocalMinutes(i.startsAt, tz), endMin, client: i.client?.name ?? "Bez imena", services: [i.serviceName] });
        }
      }
      return {
        staffId: s.id,
        date,
        shifts: sched?.shifts ?? [],
        regular: sched?.regular ?? [],
        isOverride: sched?.source === "override",
        closedReason: sched?.source === "closed" ? (sched.note ?? "Salon ne radi") : null,
        rotationWeek: sched?.rotationWeek ?? null,
        note: sched?.source === "override" ? (sched.note ?? null) : null,
        absences: absences
          .filter((a) => a.staffId === s.id && a.startsAt < end && a.endsAt > start)
          .map((a) => ({
            reason: a.reason,
            allDay: a.startsAt <= start && a.endsAt >= end,
            startMin: a.startsAt <= start ? 0 : toLocalMinutes(a.startsAt, tz),
            endMin: a.endsAt >= end ? 1440 : toLocalMinutes(a.endsAt, tz),
          })),
        visits: [...visits.values()].sort((a, b) => a.startMin - b.startMin),
        conflicts: conflicts.filter((c) => c.staffId === s.id && c.date === date).length,
      };
    }),
  );

  return (
    <>
      <PageHeader
        title="Smjene"
        description="Ko radi kog dana. Izmjena za jedan dan ne dira redovni raspored."
      />
      <ShiftsBoard
        today={today}
        weekStart={weekStart}
        days={days}
        staff={staff.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
        cells={cells}
        conflicts={conflicts}
      />
    </>
  );
}
