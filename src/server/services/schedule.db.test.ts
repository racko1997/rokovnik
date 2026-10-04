// Izmjene rasporeda za jedan dan, konflikti s postojećim terminima i premještanje.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { appointmentItems, salons } from "../db/schema";
import { addDays, isoWeekday, toLocalDate, toLocalMinutes, zonedToUtc } from "../domain/time";
import { DomainError } from "../errors";
import {
  createAppointment,
  getAvailability,
  listScheduleConflicts,
  moveAppointment,
  suggestReassignment,
} from "./booking";
import { saveService } from "./catalog";
import type { Salon } from "./salons";
import { clearDayOverride, setDayOverride } from "./schedule";
import { addTimeOff, saveStaff } from "./staff";

const TZ = "Europe/Sarajevo";
let salon: Salon;
let ana: string;
let edin: string;
let haircut: string;
let apptId: string;

let wed = addDays(toLocalDate(new Date(), TZ), 7);
while (isoWeekday(wed) !== 3) wed = addDays(wed, 1);
const at = (hhmm: string, date = wed) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedToUtc(date, h * 60 + m, TZ);
};
const slotsOf = async (staffId: string) => {
  const [day] = await getAvailability(salon, { serviceIds: [haircut], staffId, from: wed }, { mode: "public" });
  return day.slots.map((s) => toLocalMinutes(new Date(s.start), TZ));
};

beforeAll(async () => {
  [salon] = await db
    .insert(salons)
    .values({ name: "Raspored test", slug: `raspored-${crypto.randomUUID().slice(0, 8)}`, timezone: TZ, slotIntervalMin: 30 })
    .returning();
  const hours = [{ weekday: 3, startMin: 9 * 60, endMin: 13 * 60 }];
  ana = await saveStaff(salon.id, null, { name: "Ana", color: "rubin", hours });
  edin = await saveStaff(salon.id, null, { name: "Edin", color: "bakar", hours });
  haircut = await saveService(salon.id, null, { name: "Šišanje", durationMin: 60, price: 20, staffIds: [ana, edin] });
  ({ appointmentId: apptId } = await createAppointment(
    salon,
    { serviceIds: [haircut], staffId: ana, startsAt: at("10:00"), client: { name: "Klijent", phone: "061 222 333" } },
    { mode: "staff" },
  ));
});

afterAll(async () => {
  if (salon) await db.delete(salons).where(eq(salons.id, salon.id));
});

describe("izmjene rasporeda", () => {
  it("izmjena za jedan dan mijenja slobodne termine samo taj dan", async () => {
    await setDayOverride(salon.id, { staffId: edin, date: wed, shifts: [{ startMin: 11 * 60, endMin: 13 * 60 }] });
    expect(await slotsOf(edin)).toEqual([11 * 60, 11 * 60 + 30, 12 * 60]);
    // Sedmicu kasnije važi redovni raspored
    const [next] = await getAvailability(salon, { serviceIds: [haircut], staffId: edin, from: addDays(wed, 7) }, { mode: "public" });
    expect(toLocalMinutes(new Date(next.slots[0].start), TZ)).toBe(9 * 60);
    await clearDayOverride(salon.id, edin, wed);
    expect((await slotsOf(edin))[0]).toBe(9 * 60);
  });

  it("slobodan dan pravi konflikt s postojećim terminom", async () => {
    await setDayOverride(salon.id, { staffId: ana, date: wed, shifts: [], note: "Privatno" });
    expect(await slotsOf(ana)).toEqual([]);
    const conflicts = await listScheduleConflicts(salon, { from: wed, days: 1 });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ appointmentId: apptId, staffId: ana, reason: "day_off", startMin: 600, endMin: 660 });
  });

  it("predlaže slobodnog radnika i prebacuje termin", async () => {
    expect(await suggestReassignment(salon, apptId, ana)).toEqual([edin]);
    await moveAppointment(salon, { appointmentId: apptId, fromStaffId: ana, toStaffId: edin });
    expect(await listScheduleConflicts(salon, { from: wed, days: 1 })).toHaveLength(0);
    await clearDayOverride(salon.id, ana, wed);
  });

  it("smjena koja više ne pokriva termin = van radnog vremena", async () => {
    await setDayOverride(salon.id, { staffId: edin, date: wed, shifts: [{ startMin: 9 * 60, endMin: 10 * 60 + 30 }] });
    const [c] = await listScheduleConflicts(salon, { from: wed, days: 1 });
    expect(c.reason).toBe("outside_hours");
    await clearDayOverride(salon.id, edin, wed);
  });

  it("odsustvo pravi konflikt", async () => {
    await addTimeOff(salon.id, { staffId: edin, startsAt: at("09:30"), endsAt: at("10:30"), reason: "Doktor" });
    const [c] = await listScheduleConflicts(salon, { from: wed, days: 1 });
    expect(c.reason).toBe("time_off");
  });

  it("pomjera termin na drugo vrijeme i čuva trajanje", async () => {
    await moveAppointment(salon, { appointmentId: apptId, fromStaffId: edin, toStaffId: ana, startsAt: at("11:30") });
    const [item] = await db.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, apptId));
    expect(item.staffId).toBe(ana);
    expect(toLocalMinutes(item.startsAt, TZ)).toBe(11 * 60 + 30);
    expect(toLocalMinutes(item.endsAt, TZ)).toBe(12 * 60 + 30);
  });

  it("ne može pomjeriti preko drugog termina", async () => {
    await createAppointment(
      salon,
      { serviceIds: [haircut], staffId: edin, startsAt: at("12:00"), client: { name: "Drugi", phone: "061 444 555" } },
      { mode: "staff" },
    );
    const err = await moveAppointment(salon, { appointmentId: apptId, fromStaffId: ana, toStaffId: edin, startsAt: at("11:30") }).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe("SLOT_TAKEN");
    // Termin je ostao gdje je bio
    const [item] = await db.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, apptId));
    expect(item.staffId).toBe(ana);
    expect(item.active).toBe(true);
  });
});
