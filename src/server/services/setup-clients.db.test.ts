// Brzo postavljanje salona iz šablona i statistika klijenata.
import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SALON_TEMPLATES } from "@/lib/service-templates";
import { db } from "../db/client";
import { salonMembers, salons, user } from "../db/schema";
import { addDays, isoWeekday, toLocalDate, zonedToUtc } from "../domain/time";
import { DomainError } from "../errors";
import { createAppointment, getAvailability, setAppointmentStatus } from "./booking";
import { listServices } from "./catalog";
import { getClientHistory, listClientsWithStats, saveClient } from "./clients";
import type { Salon } from "./salons";
import { applyQuickSetup } from "./setup";
import { listStaff } from "./staff";

const TZ = "Europe/Sarajevo";
const ownerId = crypto.randomUUID();
let salon: Salon;

let mon = addDays(toLocalDate(new Date(), TZ), 7);
while (isoWeekday(mon) !== 1) mon = addDays(mon, 1);
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedToUtc(date, h * 60 + m, TZ);
};

beforeAll(async () => {
  await db.insert(user).values({ id: ownerId, name: "Vlasnica", email: `vlasnica-${ownerId.slice(0, 6)}@test.rokovnik` });
  [salon] = await db.insert(salons).values({ name: "Setup test", slug: `setup-${crypto.randomUUID().slice(0, 8)}`, timezone: TZ, minLeadMin: 0 }).returning();
  await db.insert(salonMembers).values({ salonId: salon.id, userId: ownerId, role: "owner" });
});

afterAll(async () => {
  if (salon) await db.delete(salons).where(eq(salons.id, salon.id));
  await db.delete(user).where(inArray(user.id, [ownerId]));
});

describe("brzo postavljanje", () => {
  it("pravi radnike, radno vrijeme i usluge iz šablona i veže vlasnika", async () => {
    const tpl = SALON_TEMPLATES.find((t) => t.key === "zene")!;
    const res = await applyQuickSetup(salon.id, ownerId, {
      services: tpl.services.slice(0, 4).map((s) => ({ ...s, categoryName: tpl.category })),
      staff: [
        { name: "Vlasnica", isMe: true },
        { name: "Ena", isMe: false },
      ],
      hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 17 * 60 })),
    });
    expect(res).toEqual({ staff: 2, services: 4 });

    const [staff, services] = await Promise.all([listStaff(salon.id), listServices(salon.id)]);
    expect(staff.map((s) => s.name)).toEqual(["Vlasnica", "Ena"]);
    expect(new Set(staff.map((s) => s.color)).size).toBe(2);
    expect(staff[0].hours).toHaveLength(5);
    expect(services.every((s) => s.staffIds.length === 2)).toBe(true);
    // Farbanje izrastka zadržava vrijeme djelovanja iz šablona
    expect(services.find((s) => s.name === "Farbanje izrastka")).toMatchObject({ gapStartMin: 30, gapMin: 30 });

    const member = await db.query.salonMembers.findFirst({ where: eq(salonMembers.userId, ownerId) });
    expect(member?.staffId).toBe(staff[0].id);
  });

  it("odmah nudi slobodne termine", async () => {
    const [haircut] = (await listServices(salon.id)).filter((s) => s.name === "Žensko šišanje");
    const [day] = await getAvailability(salon, { serviceIds: [haircut.id], from: mon }, { mode: "public" });
    expect(day.slots.length).toBeGreaterThan(0);
  });

  it("odbija postavljanje bez radnika", async () => {
    const err = await applyQuickSetup(salon.id, ownerId, {
      services: [{ name: "X", durationMin: 30, price: 10, categoryName: "Ostalo" }],
      staff: [],
      hours: [{ weekday: 1, startMin: 540, endMin: 600 }],
    }).catch((e) => e);
    expect(err.name).toBe("ZodError");
  });
});

describe("klijenti", () => {
  it("statistika: posjete, nedolasci, sljedeći termin", async () => {
    const [haircut] = (await listServices(salon.id)).filter((s) => s.name === "Žensko šišanje");
    const client = { name: "Mirela Test", phone: "061 777 000" };
    const a = await createAppointment(salon, { serviceIds: [haircut.id], startsAt: at(mon, "09:00"), client }, { mode: "staff" });
    await createAppointment(salon, { serviceIds: [haircut.id], startsAt: at(addDays(mon, 7), "09:00"), client }, { mode: "staff" });
    await setAppointmentStatus(salon.id, a.appointmentId, "no_show");

    const { rows, total } = await listClientsWithStats(salon.id, { q: "777" });
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ name: "Mirela Test", noShows: 1, visits: 0 });
    expect(rows[0].nextVisit).toBeInstanceOf(Date);

    const history = await getClientHistory(salon.id, rows[0].id);
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.status)).toContain("no_show");
  });

  it("ne dozvoljava dva klijenta s istim brojem", async () => {
    const err = await saveClient(salon.id, null, { name: "Duplikat", phone: "+387 61 777 000" }).catch((e) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).message).toContain("već postoji");
  });

  it("napomene se spremaju", async () => {
    const id = await saveClient(salon.id, null, { name: "Nova Klijentica", phone: "062 111 999", notes: "Alergija na amonijak" });
    const { rows } = await listClientsWithStats(salon.id, { q: "Nova" });
    expect(rows[0]).toMatchObject({ id, notes: "Alergija na amonijak", visits: 0 });
  });
});
