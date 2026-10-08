// Analitika nad pravom bazom: prihod i termini po radniku, ostvareno naspram zakazanog.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { salons } from "../db/schema";
import { addDays, isoWeekday, toLocalDate, zonedToUtc } from "../domain/time";
import { createAppointment, setAppointmentStatus } from "./booking";
import { saveService } from "./catalog";
import { getReport } from "./reports";
import type { Salon } from "./salons";
import { saveStaff } from "./staff";

const TZ = "Europe/Sarajevo";
let salon: Salon;
let ana: string;
let edin: string;
let haircut: string;
let color: string;

// Ponedjeljak prije dvije sedmice (prošlost) i za dvije sedmice (budućnost)
const today = toLocalDate(new Date(), TZ);
let pastMonday = addDays(today, -14);
while (isoWeekday(pastMonday) !== 1) pastMonday = addDays(pastMonday, -1);
const futureMonday = addDays(pastMonday, 28);
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedToUtc(date, h * 60 + m, TZ);
};

beforeAll(async () => {
  [salon] = await db
    .insert(salons)
    .values({ name: "Test analitika", slug: `test-${crypto.randomUUID().slice(0, 8)}`, timezone: TZ })
    .returning();
  const hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 17 * 60 }));
  ana = await saveStaff(salon.id, null, { name: "Ana", color: "rubin", hours });
  edin = await saveStaff(salon.id, null, { name: "Edin", color: "bakar", hours });
  haircut = await saveService(salon.id, null, { name: "Šišanje", durationMin: 30, price: 20, staffIds: [ana, edin] });
  color = await saveService(salon.id, null, { name: "Boja", durationMin: 60, price: 50, staffIds: [ana] });

  const book = (staffId: string, serviceIds: string[], startsAt: Date, n: number, source: "dashboard" | "online" = "dashboard") =>
    createAppointment(
      salon,
      { serviceIds, staffId, startsAt, client: { name: `Klijent ${n}`, phone: `061 900 ${String(100 + n)}` }, source, allowPast: true },
      { mode: "staff" },
    );

  // Prošlost: Ana šišanje + boja (70), Edin šišanje (20), Edin nedolazak, Ana otkazano
  const a1 = await book(ana, [haircut, color], at(pastMonday, "09:00"), 1, "online");
  await setAppointmentStatus(salon.id, a1.appointmentId, "completed");
  await book(edin, [haircut], at(pastMonday, "10:00"), 2);
  const ns = await book(edin, [haircut], at(pastMonday, "11:00"), 3);
  await setAppointmentStatus(salon.id, ns.appointmentId, "no_show");
  const c = await book(ana, [color], at(pastMonday, "13:00"), 4);
  await setAppointmentStatus(salon.id, c.appointmentId, "cancelled");
  // Budućnost: Ana boja (50)
  await book(ana, [color], at(futureMonday, "09:00"), 5, "online");
});

afterAll(async () => {
  if (salon) await db.delete(salons).where(eq(salons.id, salon.id));
});

describe("analitika", () => {
  it("odvaja ostvareno od zakazanog i ne broji otkazane ni nedolaske u prihod", async () => {
    const r = await getReport(salon, pastMonday, addDays(futureMonday, 6));
    expect(r.totals.revenueCents).toBe(9000);
    expect(r.totals.visits).toBe(2);
    expect(r.totals.upcomingCents).toBe(5000);
    expect(r.totals.upcomingVisits).toBe(1);
    expect(r.totals.noShow).toBe(1);
    expect(r.totals.cancelled).toBe(1);
    // Online: prva i buduća posjeta, od 4 neotkazane
    expect(r.totals.selfBooked).toBe(2);
    expect(r.totals.booked).toBe(4);
  });

  it("prihod i termini po radniku", async () => {
    const r = await getReport(salon, pastMonday, addDays(futureMonday, 6));
    const byName = Object.fromEntries(r.staff.map((s) => [s.name, s]));
    expect(byName.Ana.revenueCents).toBe(7000);
    expect(byName.Ana.visits).toBe(1);
    expect(byName.Ana.upcomingCents).toBe(5000);
    expect(byName.Edin.revenueCents).toBe(2000);
    expect(byName.Edin.visits).toBe(1);
    // Najveći prihod prvi
    expect(r.staff[0].name).toBe("Ana");
  });

  it("usluge i prethodni period", async () => {
    const r = await getReport(salon, pastMonday, pastMonday);
    expect(r.services.find((s) => s.name === "Šišanje")).toEqual({ name: "Šišanje", count: 2, revenueCents: 4000 });
    // Sedmicu ranije nije bilo ničega
    expect(r.previous.revenueCents).toBe(0);
    expect(r.daily).toHaveLength(1);
    expect(r.daily[0].visits).toBe(2);
  });
});
