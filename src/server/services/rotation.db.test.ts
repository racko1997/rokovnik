// Smjene koje se izmjenjuju (sedmica A/B) i neradni dani salona.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { salons } from "../db/schema";
import { addDays, isoWeekday, toLocalDate, toLocalMinutes } from "../domain/time";
import { getAvailability, listScheduleConflicts, createAppointment } from "./booking";
import { saveService } from "./catalog";
import type { Salon } from "./salons";
import { addClosure, loadSchedules, rotationWeekIndex, setDayOverride } from "./schedule";
import { saveStaff } from "./staff";
import { zonedToUtc } from "../domain/time";

const TZ = "Europe/Sarajevo";
let salon: Salon;
let mia: string;
let haircut: string;

// Ponedjeljak sedmice A (bar 7 dana unaprijed) i ponedjeljak sedmice B
let mondayA = addDays(toLocalDate(new Date(), TZ), 7);
while (isoWeekday(mondayA) !== 1) mondayA = addDays(mondayA, 1);
const mondayB = addDays(mondayA, 7);

const firstSlot = async (date: string) => {
  const [day] = await getAvailability(salon, { serviceIds: [haircut], staffId: mia, from: date }, { mode: "public" });
  return day.slots.length ? toLocalMinutes(new Date(day.slots[0].start), TZ) : null;
};

beforeAll(async () => {
  [salon] = await db
    .insert(salons)
    .values({ name: "Rotacija test", slug: `rotacija-${crypto.randomUUID().slice(0, 8)}`, timezone: TZ })
    .returning();
  mia = await saveStaff(salon.id, null, {
    name: "Mia",
    color: "rubin",
    rotationWeeks: 2,
    // Bilo koji dan sedmice A — sprema se ponedjeljak
    rotationAnchor: addDays(mondayA, 2),
    hours: [
      { weekday: 1, week: 0, startMin: 8 * 60, endMin: 14 * 60 },
      { weekday: 1, week: 1, startMin: 14 * 60, endMin: 20 * 60 },
    ],
  });
  haircut = await saveService(salon.id, null, { name: "Šišanje", durationMin: 60, price: 20, staffIds: [mia] });
});

afterAll(async () => {
  if (salon) await db.delete(salons).where(eq(salons.id, salon.id));
});

describe("rotacija smjena", () => {
  it("računa sedmicu A/B i za prošle sedmice", () => {
    expect(rotationWeekIndex(mondayA, mondayA)).toBe(0);
    expect(rotationWeekIndex(mondayA, addDays(mondayA, 6))).toBe(0);
    expect(rotationWeekIndex(mondayA, mondayB)).toBe(1);
    expect(rotationWeekIndex(mondayA, addDays(mondayA, 14))).toBe(0);
    expect(rotationWeekIndex(mondayA, addDays(mondayA, -7))).toBe(1);
  });

  it("sedmica A jutro, sedmica B popodne", async () => {
    expect(await firstSlot(mondayA)).toBe(8 * 60);
    expect(await firstSlot(mondayB)).toBe(14 * 60);
    expect(await firstSlot(addDays(mondayA, 14))).toBe(8 * 60);
  });

  it("raspored pokazuje koja je sedmica", async () => {
    const sched = await loadSchedules(db, [mia], mondayA, 8);
    expect(sched.get(mia)!.get(mondayA)!.rotationWeek).toBe(0);
    expect(sched.get(mia)!.get(mondayB)!.rotationWeek).toBe(1);
  });
});

describe("neradni dani salona", () => {
  it("zatvara salon za sve i pravi konflikt s postojećim terminom", async () => {
    const monday3 = addDays(mondayA, 14);
    await createAppointment(
      salon,
      { serviceIds: [haircut], staffId: mia, startsAt: zonedToUtc(monday3, 9 * 60, TZ), client: { name: "Ena", phone: "061 777 888" } },
      { mode: "staff" },
    );
    await addClosure(salon.id, { startDate: monday3, endDate: monday3, reason: "Praznik" });
    expect(await firstSlot(monday3)).toBeNull();
    const [c] = await listScheduleConflicts(salon, { from: monday3, days: 1 });
    expect(c.reason).toBe("day_off");
    const sched = await loadSchedules(db, [mia], monday3, 1);
    expect(sched.get(mia)!.get(monday3)).toMatchObject({ source: "closed", note: "Praznik" });
  });

  it("izmjena za dan je jača od neradnog dana (radi i na praznik)", async () => {
    const monday3 = addDays(mondayA, 14);
    await setDayOverride(salon.id, { staffId: mia, date: monday3, shifts: [{ startMin: 9 * 60, endMin: 12 * 60 }] });
    expect(await listScheduleConflicts(salon, { from: monday3, days: 1 })).toHaveLength(0);
    // 9:00 je zauzet postojećim terminom, prvi slobodan je 10:00
    expect(await firstSlot(monday3)).toBe(10 * 60);
  });
});
