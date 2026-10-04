// Vrijeme djelovanja: radnik je slobodan dok boja djeluje i može uzeti drugog klijenta.
import "dotenv/config";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { appointmentItems, salons } from "../db/schema";
import { addDays, isoWeekday, toLocalDate, toLocalMinutes, zonedToUtc } from "../domain/time";
import { DomainError } from "../errors";
import { busySegments, createAppointment, getAvailability, moveAppointment } from "./booking";
import { saveService } from "./catalog";
import type { Salon } from "./salons";
import { saveStaff } from "./staff";

const TZ = "Europe/Sarajevo";
let salon: Salon;
let mia: string;
let color: string;
let blowdry: string;
let colorAppt: string;

let fri = addDays(toLocalDate(new Date(), TZ), 7);
while (isoWeekday(fri) !== 5) fri = addDays(fri, 1);
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedToUtc(fri, h * 60 + m, TZ);
};
const hm = (d: Date) => {
  const m = toLocalMinutes(d, TZ);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

beforeAll(async () => {
  [salon] = await db
    .insert(salons)
    .values({ name: "Djelovanje test", slug: `gap-${crypto.randomUUID().slice(0, 8)}`, timezone: TZ, slotIntervalMin: 15, minLeadMin: 0 })
    .returning();
  mia = await saveStaff(salon.id, null, { name: "Mia", color: "rubin", hours: [{ weekday: 5, startMin: 9 * 60, endMin: 13 * 60 }] });
  // Farbanje 90 min: nanošenje 30, djelovanje 30 (radnica slobodna), ispiranje i feniranje 30
  color = await saveService(salon.id, null, { name: "Farbanje", durationMin: 90, gapStartMin: 30, gapMin: 30, price: 60, staffIds: [mia] });
  blowdry = await saveService(salon.id, null, { name: "Feniranje", durationMin: 30, price: 15, staffIds: [mia] });
});

afterAll(async () => {
  if (salon) await db.delete(salons).where(eq(salons.id, salon.id));
});

describe("vrijeme djelovanja", () => {
  it("dijelovi zauzetosti za niz usluga", () => {
    const s = { bufferMin: 0, gapStartMin: 0, gapMin: 0 };
    expect(
      busySegments([
        { ...s, durationMin: 90, gapStartMin: 30, gapMin: 30 },
        { ...s, durationMin: 30 },
      ]),
    ).toEqual([
      { offsetMin: 0, durationMin: 30 },
      { offsetMin: 60, durationMin: 60 },
    ]);
  });

  it("termin s djelovanjem se upisuje u dva dijela", async () => {
    ({ appointmentId: colorAppt } = await createAppointment(
      salon,
      { serviceIds: [color], staffId: mia, startsAt: at("09:00"), client: { name: "Amra", phone: "061 100 200" } },
      { mode: "public" },
    ));
    const items = await db.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, colorAppt)).orderBy(asc(appointmentItems.startsAt));
    expect(items.map((i) => [hm(i.startsAt), hm(i.endsAt), i.part, i.priceCents])).toEqual([
      ["09:00", "09:30", 0, 6000],
      ["10:00", "10:30", 1, 0],
    ]);
  });

  it("u rupi se nudi i upisuje drugi klijent", async () => {
    const [day] = await getAvailability(salon, { serviceIds: [blowdry], staffId: mia, from: fri }, { mode: "public" });
    expect(day.slots.map((s) => hm(new Date(s.start)))).toContain("09:30");
    const res = await createAppointment(
      salon,
      { serviceIds: [blowdry], staffId: mia, startsAt: at("09:30"), client: { name: "Lejla", phone: "061 300 400" } },
      { mode: "public" },
    );
    expect(res.staffId).toBe(mia);
  });

  it("predugačka usluga ne stane u rupu", async () => {
    const err = await createAppointment(
      salon,
      { serviceIds: [color], staffId: mia, startsAt: at("09:30"), client: { name: "Treći", phone: "061 500 600" } },
      { mode: "staff" },
    ).catch((e) => e);
    expect((err as DomainError).code).toBe("SLOT_TAKEN");
  });

  it("pomjeranje čuva rupu i dijelove", async () => {
    await moveAppointment(salon, { appointmentId: colorAppt, fromStaffId: mia, toStaffId: mia, startsAt: at("11:00") });
    const items = await db.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, colorAppt)).orderBy(asc(appointmentItems.startsAt));
    expect(items.map((i) => [hm(i.startsAt), hm(i.endsAt)])).toEqual([
      ["11:00", "11:30"],
      ["12:00", "12:30"],
    ]);
  });
});
