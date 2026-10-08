// Analitika za vlasnika: termini, prihod, radnici, usluge i kanali za odabrani period.
// Prihod je po cjenovniku u trenutku rezervacije (stavke termina); za cijene "od"
// računa se najniža cijena. "Ostvareno" = termini koji su već počeli i nisu otkazani
// ni propušteni; budući termini u periodu su "zakazano".
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { appointmentItems, appointments, staff } from "../db/schema";
import { addDays, dayBounds, type LocalDate, toLocalDate } from "../domain/time";
import type { Salon } from "./salons";
import { loadSchedules } from "./schedule";

const MIN = 60_000;
const LIVE = ["booked", "confirmed", "completed"] as const;

export interface Totals {
  /** Posjete koje su se desile (ili se dešavaju), bez otkazanih i nedolazaka */
  visits: number;
  revenueCents: number;
  /** Budući termini u periodu */
  upcomingVisits: number;
  upcomingCents: number;
  cancelled: number;
  noShow: number;
  /** Termini koje su klijenti zakazali sami (online, AI, poruke) — od svih koji nisu otkazani */
  selfBooked: number;
  booked: number;
}

export interface StaffRow {
  id: string;
  name: string;
  color: string;
  visits: number;
  revenueCents: number;
  upcomingCents: number;
  bookedMin: number;
  scheduledMin: number;
}

export interface Report {
  from: LocalDate;
  to: LocalDate;
  totals: Totals;
  previous: Totals;
  newClients: number;
  daily: { date: LocalDate; revenueCents: number; upcomingCents: number; visits: number }[];
  staff: StaffRow[];
  services: { name: string; count: number; revenueCents: number }[];
  sources: { source: string; count: number }[];
}

async function loadRows(salonId: string, start: Date, end: Date) {
  return db
    .select({
      appointmentId: appointments.id,
      status: appointments.status,
      source: appointments.source,
      apptStart: appointments.startsAt,
      staffId: appointmentItems.staffId,
      serviceName: appointmentItems.serviceName,
      priceCents: appointmentItems.priceCents,
      part: appointmentItems.part,
      startsAt: appointmentItems.startsAt,
      endsAt: appointmentItems.endsAt,
    })
    .from(appointments)
    .innerJoin(appointmentItems, eq(appointmentItems.appointmentId, appointments.id))
    .where(and(eq(appointments.salonId, salonId), gte(appointments.startsAt, start), lt(appointments.startsAt, end)));
}

type Row = Awaited<ReturnType<typeof loadRows>>[number];

function totalsOf(rows: Row[], now: Date): Totals {
  const t: Totals = { visits: 0, revenueCents: 0, upcomingVisits: 0, upcomingCents: 0, cancelled: 0, noShow: 0, selfBooked: 0, booked: 0 };
  const seen = new Set<string>();
  for (const r of rows) {
    const live = (LIVE as readonly string[]).includes(r.status);
    const past = r.apptStart <= now;
    if (live) {
      if (past) t.revenueCents += r.priceCents;
      else t.upcomingCents += r.priceCents;
    }
    if (seen.has(r.appointmentId)) continue;
    seen.add(r.appointmentId);
    if (r.status === "cancelled") t.cancelled++;
    else if (r.status === "no_show") t.noShow++;
    else if (past) t.visits++;
    else t.upcomingVisits++;
    if (r.status !== "cancelled") {
      t.booked++;
      if (r.source !== "dashboard") t.selfBooked++;
    }
  }
  return t;
}

/** Izvještaj za lokalne datume [from, to] (oba uključena). */
export async function getReport(salon: Salon, from: LocalDate, to: LocalDate, now = new Date()): Promise<Report> {
  const tz = salon.timezone;
  const start = dayBounds(from, tz).start;
  const end = dayBounds(to, tz).end;
  const days = Math.round((dayBounds(to, tz).start.getTime() - start.getTime()) / (24 * 60 * MIN)) + 1;
  const prevFrom = addDays(from, -days);

  const [rows, prevRows, staffList, [{ n: newClients }]] = await Promise.all([
    loadRows(salon.id, start, end),
    loadRows(salon.id, dayBounds(prevFrom, tz).start, start),
    db.select({ id: staff.id, name: staff.name, color: staff.color }).from(staff).where(eq(staff.salonId, salon.id)).orderBy(staff.sortOrder),
    // Klijenti čija je prva (neotkazana) posjeta u ovom periodu
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(
        db
          .select({ first: sql<Date>`min(${appointments.startsAt})`.as("first") })
          .from(appointments)
          .where(and(eq(appointments.salonId, salon.id), inArray(appointments.status, [...LIVE])))
          .groupBy(appointments.clientId)
          .as("firsts"),
      )
      .where(sql`first >= ${start.toISOString()}::timestamptz and first < ${end.toISOString()}::timestamptz`),
  ]);

  const live = rows.filter((r) => (LIVE as readonly string[]).includes(r.status));

  // Po danu
  const dayMap = new Map<LocalDate, { revenueCents: number; upcomingCents: number; visits: Set<string> }>();
  for (let i = 0; i < days; i++) dayMap.set(addDays(from, i), { revenueCents: 0, upcomingCents: 0, visits: new Set() });
  for (const r of live) {
    const d = dayMap.get(toLocalDate(r.apptStart, tz));
    if (!d) continue;
    if (r.apptStart <= now) d.revenueCents += r.priceCents;
    else d.upcomingCents += r.priceCents;
    d.visits.add(r.appointmentId);
  }

  // Po radniku: prihod po stavkama (posjeta s dva radnika se dijeli tačno po uslugama)
  const schedules = await loadSchedules(db, staffList.map((s) => s.id), from, days);
  const staffRows: StaffRow[] = staffList.map((s) => {
    let scheduledMin = 0;
    for (const day of schedules.get(s.id)?.values() ?? []) for (const sh of day.shifts) scheduledMin += sh.endMin - sh.startMin;
    const mine = live.filter((r) => r.staffId === s.id);
    return {
      ...s,
      visits: new Set(mine.filter((r) => r.apptStart <= now).map((r) => r.appointmentId)).size,
      revenueCents: mine.filter((r) => r.apptStart <= now).reduce((sum, r) => sum + r.priceCents, 0),
      upcomingCents: mine.filter((r) => r.apptStart > now).reduce((sum, r) => sum + r.priceCents, 0),
      bookedMin: mine.reduce((sum, r) => sum + (r.endsAt.getTime() - r.startsAt.getTime()) / MIN, 0),
      scheduledMin,
    };
  });

  // Po usluzi (samo prvi dio usluge, da se usluga s pauzom ne broji dvaput)
  const svc = new Map<string, { count: number; revenueCents: number }>();
  for (const r of live) {
    if (r.part !== 0) continue;
    const s = svc.get(r.serviceName) ?? { count: 0, revenueCents: 0 };
    s.count++;
    s.revenueCents += r.priceCents;
    svc.set(r.serviceName, s);
  }

  // Po kanalu (posjete, bez otkazanih)
  const src = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    src.set(r.source, (src.get(r.source) ?? new Set()).add(r.appointmentId));
  }

  return {
    from,
    to,
    totals: totalsOf(rows, now),
    previous: totalsOf(prevRows, now),
    newClients,
    daily: [...dayMap.entries()].map(([date, d]) => ({ date, revenueCents: d.revenueCents, upcomingCents: d.upcomingCents, visits: d.visits.size })),
    staff: staffRows.filter((s) => s.visits || s.upcomingCents || s.scheduledMin).sort((a, b) => b.revenueCents - a.revenueCents),
    services: [...svc.entries()].map(([name, s]) => ({ name, ...s })).sort((a, b) => b.revenueCents - a.revenueCents),
    sources: [...src.entries()].map(([source, ids]) => ({ source, count: ids.size })).sort((a, b) => b.count - a.count),
  };
}
