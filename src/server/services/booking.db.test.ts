// Integracioni testovi nad pravom bazom (npm run db:start, pa npm run test:db).
// Svaki test radi u svom privremenom salonu koji se na kraju briše.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { salons } from "../db/schema";
import { addDays, isoWeekday, toLocalDate, zonedToUtc } from "../domain/time";
import { DomainError } from "../errors";
import { createAppointment, getAvailability, setAppointmentStatus } from "./booking";
import { saveService } from "./catalog";
import type { Salon } from "./salons";
import { saveStaff } from "./staff";

const TZ = "Europe/Sarajevo";
let salon: Salon;
let ana: string;
let edin: string;
let haircut: string;
let phoneOnly: string;

// Sljedeći ponedjeljak, bar 7 dana od danas
const today = toLocalDate(new Date(), TZ);
let monday = addDays(today, 7);
while (isoWeekday(monday) !== 1) monday = addDays(monday, 1);
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedToUtc(monday, h * 60 + m, TZ);
};
const client = (n: number) => ({ name: `Test Klijent ${n}`, phone: `061 000 ${String(100 + n).padStart(3, "0")}` });

async function expectDomainError(p: Promise<unknown>, code: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

beforeAll(async () => {
  [salon] = await db
    .insert(salons)
    .values({ name: "Test salon", slug: `test-${crypto.randomUUID().slice(0, 8)}`, timezone: TZ, minLeadMin: 60 })
    .returning();
  const hours = [{ weekday: 1, startMin: 9 * 60, endMin: 12 * 60 }];
  ana = await saveStaff(salon.id, null, { name: "Ana", color: "rubin", hours });
  edin = await saveStaff(salon.id, null, { name: "Edin", color: "bakar", hours });
  haircut = await saveService(salon.id, null, {
    name: "Šišanje", durationMin: 30, bufferMin: 10, price: 20, staffIds: [ana, edin],
  });
  phoneOnly = await saveService(salon.id, null, {
    name: "Svečana", durationMin: 60, price: 50, staffIds: [ana], bookableOnline: false,
  });
});

afterAll(async () => {
  if (salon) await db.delete(salons).where(eq(salons.id, salon.id));
});

describe("rezervacije", () => {
  it("nudi slobodne termine u radnom vremenu", async () => {
    const [day] = await getAvailability(salon, { serviceIds: [haircut], from: monday }, { mode: "public" });
    expect(day.slots[0].start).toBe(at("09:00").toISOString());
    expect(day.slots[0].staffIds).toEqual([ana, edin]);
    // 30 min + 10 buffer mora stati do 12:00 → zadnji početak 11:15 (mreža 15 min)
    expect(day.slots.at(-1)!.start).toBe(at("11:15").toISOString());
  });

  it("odbija drugi termin kod istog radnika u isto vrijeme", async () => {
    await createAppointment(salon, { serviceIds: [haircut], staffId: ana, startsAt: at("09:00"), client: client(1), source: "online" }, { mode: "public" });
    await expectDomainError(
      createAppointment(salon, { serviceIds: [haircut], staffId: ana, startsAt: at("09:15"), client: client(2) }, { mode: "public" }),
      "SLOT_TAKEN",
    );
  });

  it("buffer blokira radnika i nakon usluge", async () => {
    // Ana: 09:00–09:30 + 10 min buffer → slobodna od 09:40
    const [day] = await getAvailability(salon, { serviceIds: [haircut], staffId: ana, from: monday }, { mode: "public" });
    expect(day.slots[0].start).toBe(at("09:40").toISOString());
  });

  it("'bilo ko' bira slobodnog radnika", async () => {
    const res = await createAppointment(salon, { serviceIds: [haircut], startsAt: at("09:00"), client: client(3) }, { mode: "public" });
    expect(res.staffId).toBe(edin);
  });

  it("baza sprječava duplu rezervaciju i kad stignu istovremeno", async () => {
    const attempt = (n: number) =>
      createAppointment(salon, { serviceIds: [haircut], staffId: ana, startsAt: at("10:30"), client: client(n) }, { mode: "staff" });
    const results = await Promise.allSettled([attempt(4), attempt(5), attempt(6)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      const reason = (r as PromiseRejectedResult).reason;
      expect(reason.code, String(reason?.cause ?? reason)).toBe("SLOT_TAKEN");
    }
  });

  it("otkazivanje oslobađa termin", async () => {
    const res = await createAppointment(salon, { serviceIds: [haircut], staffId: edin, startsAt: at("11:00"), client: client(7) }, { mode: "staff" });
    await setAppointmentStatus(salon.id, res.appointmentId, "cancelled");
    const again = await createAppointment(salon, { serviceIds: [haircut], staffId: edin, startsAt: at("11:00"), client: client(8) }, { mode: "public" });
    expect(again.staffId).toBe(edin);
  });

  it("klijent ne može zakazati van radnog vremena, recepcija može", async () => {
    await expectDomainError(
      createAppointment(salon, { serviceIds: [haircut], staffId: ana, startsAt: at("12:00"), client: client(9) }, { mode: "public" }),
      "SLOT_TAKEN",
    );
    const res = await createAppointment(salon, { serviceIds: [haircut], staffId: ana, startsAt: at("12:00"), client: client(9) }, { mode: "staff" });
    expect(res.staffId).toBe(ana);
  });

  it("usluga 'samo telefonom' nije dostupna online", async () => {
    await expectDomainError(
      getAvailability(salon, { serviceIds: [phoneOnly], from: monday }, { mode: "public" }),
      "INVALID_INPUT",
    );
  });

  it("isti broj telefona = isti klijent", async () => {
    const a = await createAppointment(salon, { serviceIds: [haircut], staffId: edin, startsAt: at("09:40"), client: { name: "Mia", phone: "061 999 888" } }, { mode: "staff" });
    const b = await createAppointment(salon, { serviceIds: [haircut], staffId: edin, startsAt: at("10:20"), client: { name: "Mia K.", phone: "+387 61 999 888" } }, { mode: "staff" });
    const rows = await db.query.appointments.findMany({ where: (t, { inArray }) => inArray(t.id, [a.appointmentId, b.appointmentId]) });
    expect(new Set(rows.map((r) => r.clientId)).size).toBe(1);
  });

  it("recepcija ne upisuje prošli termin bez potvrde, a uz potvrdu da", async () => {
    const yesterday = new Date(Date.now() - 24 * 3600_000);
    await expectDomainError(
      createAppointment(salon, { serviceIds: [haircut], staffId: ana, startsAt: yesterday, client: client(20) }, { mode: "staff" }),
      "IN_PAST",
    );
    const res = await createAppointment(
      salon,
      { serviceIds: [haircut], staffId: ana, startsAt: yesterday, client: client(20), allowPast: true },
      { mode: "staff" },
    );
    expect(res.staffId).toBe(ana);
  });

  it("prijedlozi slobodnih termina za recepciju ne nude prošlo vrijeme", async () => {
    const today = toLocalDate(new Date(), TZ);
    const [day] = await getAvailability(salon, { serviceIds: [haircut], from: today }, { mode: "staff" });
    expect(day.slots.every((s) => new Date(s.start).getTime() >= Date.now() - 60_000)).toBe(true);
  });
});
