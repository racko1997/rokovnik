import { and, eq, gte, lt } from "drizzle-orm";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { can } from "@/lib/permissions";
import { requireSalon } from "@/server/context";
import { db } from "@/server/db/client";
import { appointments, conversations } from "@/server/db/schema";
import { addDays, dayBounds, isLocalDate, isoWeekday, toLocalDate, toLocalMinutes } from "@/server/domain/time";
import { listCalendar, listScheduleConflicts } from "@/server/services/booking";
import { listServices } from "@/server/services/catalog";
import { loadSchedules } from "@/server/services/schedule";
import { listStaff, listTimeOff } from "@/server/services/staff";
import { CalendarShell } from "./calendar-shell";
import type { CalendarData, ColorMode, Density, View } from "./types";

export const metadata: Metadata = { title: "Kalendar" };

type Search = { d?: string; v?: string; r?: string; s?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { salon, role, staffId: myStaffId } = await requireSalon();
  const tz = salon.timezone;
  const now = new Date();
  const today = toLocalDate(now, tz);
  const sp = await searchParams;
  const date = sp.d && isLocalDate(sp.d) ? sp.d : today;
  const view: View = sp.v === "sedmica" || sp.v === "lista" ? sp.v : "dan";
  const days =
    view === "sedmica" ? Array.from({ length: 7 }, (_, i) => addDays(addDays(date, 1 - isoWeekday(date)), i)) : [date];

  const jar = await cookies();
  const colorMode = (["status", "usluga", "radnik"].includes(jar.get("cal_color")?.value ?? "") ? jar.get("cal_color")!.value : "status") as ColorMode;
  const density = (jar.get("cal_density")?.value === "zbijeno" ? "zbijeno" : "udobno") as Density;

  const range = { start: dayBounds(days[0], tz).start, end: dayBounds(days[days.length - 1], tz).end };
  const tomorrow = dayBounds(addDays(today, 1), tz);

  const [staff, items, absences, services, conflictsInRange, conflictsAhead, unconfirmedTomorrow, handoffs] = await Promise.all([
    listStaff(salon.id),
    listCalendar(salon.id, range.start, range.end),
    listTimeOff(salon.id, range.start, range.end),
    listServices(salon.id),
    listScheduleConflicts(salon, { from: days[0], days: days.length }),
    listScheduleConflicts(salon, { from: today, days: 90 }),
    db.$count(
      appointments,
      and(
        eq(appointments.salonId, salon.id),
        eq(appointments.status, "booked"),
        gte(appointments.startsAt, tomorrow.start),
        lt(appointments.startsAt, tomorrow.end),
      ),
    ),
    db.$count(conversations, and(eq(conversations.salonId, salon.id), eq(conversations.status, "handoff"))),
  ]);
  const schedules = await loadSchedules(db, staff.map((s) => s.id), days[0], days.length);

  // Minute od ponoći unutar dana `day` (termini preko ponoći se odsijecaju)
  const minutesIn = (instant: Date, day: string) => {
    const { start, end } = dayBounds(day, tz);
    if (instant <= start) return 0;
    if (instant >= end) return 24 * 60;
    return toLocalMinutes(instant, tz);
  };

  const data: CalendarData = {
    view,
    date,
    days,
    today,
    nowMin: toLocalMinutes(now, tz),
    currency: salon.currency,
    staff: staff.map((s) => ({ id: s.id, name: s.name, title: s.title, color: s.color, serviceIds: s.serviceIds })),
    staffDays: staff.flatMap((s) =>
      days.map((day) => {
        const sched = schedules.get(s.id)?.get(day);
        const { start, end } = dayBounds(day, tz);
        return {
          staffId: s.id,
          date: day,
          shifts: sched?.shifts ?? [],
          isOverride: sched?.source === "override",
          closedReason: sched?.source === "closed" ? (sched.note ?? "Salon ne radi") : null,
          absences: absences
            .filter((a) => a.staffId === s.id && a.startsAt < end && a.endsAt > start)
            .map((a) => ({ startMin: minutesIn(a.startsAt, day), endMin: minutesIn(a.endsAt, day), reason: a.reason })),
        };
      }),
    ),
    items: items.map((i) => {
      const day = toLocalDate(i.startsAt, tz);
      return {
        itemId: i.itemId,
        appointmentId: i.appointmentId,
        staffId: i.staffId,
        date: day,
        serviceId: i.serviceId,
        serviceName: i.serviceName,
        priceCents: i.priceCents,
        part: i.part,
        startMin: minutesIn(i.startsAt, day),
        endMin: minutesIn(i.endsAt, day),
        blockedMin: minutesIn(i.blockedUntil, day),
        status: i.status,
        source: i.source,
        notes: i.notes,
        firstVisit: i.firstVisit,
        client: i.client,
      };
    }),
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      categoryName: s.categoryName,
      durationMin: s.durationMin,
      bufferMin: s.bufferMin,
      priceCents: s.priceCents,
      priceFrom: s.priceFrom,
      staffIds: s.staffIds,
    })),
    conflictKeys: conflictsInRange.map((c) => `${c.appointmentId}:${c.staffId}`),
    alerts: { unconfirmedTomorrow, conflictsAhead: conflictsAhead.length, handoffs },
    colorMode,
    density,
    // Radnik s nalogom vidi prvo svoje termine; "Svi" je jedan klik dalje
    staffFilter: sp.r ?? (role === "staff" && myStaffId ? myStaffId : "rade"),
    weekStaffId: sp.s && staff.some((s) => s.id === sp.s) ? sp.s : (myStaffId ?? staff[0]?.id ?? null),
    myStaffId,
    canSeeRevenue: can(role, "viewRevenue"),
  };

  return <CalendarShell key={`${view}:${days[0]}`} data={data} viewExplicit={Boolean(sp.v)} />;
}
