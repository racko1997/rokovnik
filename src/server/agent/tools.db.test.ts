// Alati AI recepcionera nad pravom bazom, bez OpenAI-ja: provjerava da AI dobija
// tačne podatke i da ne može zaobići pravila zakazivanja.
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { appointments, salons } from "../db/schema";
import { addDays, isoWeekday, toLocalDate, toLocalMinutes } from "../domain/time";
import { saveService } from "../services/catalog";
import type { Salon } from "../services/salons";
import { saveStaff } from "../services/staff";
import { getOrCreateConversation } from "./conversations";
import { runTool, type ToolContext } from "./tools";

const TZ = "Europe/Sarajevo";
let salon: Salon;
let ctx: ToolContext;
let haircut: string;
let mia: string;

let tuesday = addDays(toLocalDate(new Date(), TZ), 7);
while (isoWeekday(tuesday) !== 2) tuesday = addDays(tuesday, 1);

const call = async (name: string, args: unknown) => (await runTool(ctx, name, JSON.stringify(args))).result as Record<string, unknown>;

beforeAll(async () => {
  [salon] = await db
    .insert(salons)
    .values({ name: "Agent test", slug: `agent-${crypto.randomUUID().slice(0, 8)}`, timezone: TZ })
    .returning();
  mia = await saveStaff(salon.id, null, { name: "Mia", color: "rubin", hours: [
    { weekday: 2, startMin: 9 * 60, endMin: 11 * 60 },
    { weekday: 4, startMin: 9 * 60, endMin: 13 * 60 },
  ] });
  haircut = await saveService(salon.id, null, { name: "Šišanje", durationMin: 60, price: 25, staffIds: [mia] });
  const conv = await getOrCreateConversation(salon.id, "chat", crypto.randomUUID());
  ctx = { salon, conversationId: conv.id, channel: "chat", staffName: new Map([[mia, "Mia"]]), offeredTimes: new Set(["09:00", "09:30"]) };
});

afterAll(async () => {
  if (salon) await db.delete(salons).where(eq(salons.id, salon.id));
});

describe("alati recepcionera", () => {
  it("vraća slobodne termine s imenima radnika", async () => {
    const r = await call("find_available_slots", { service_ids: [haircut], staff_id: null, date_from: tuesday, days: 1 });
    const day = (r.days as { date: string; slots: { time: string; staff: string[] }[] }[])[0];
    expect(day.date).toBe(tuesday);
    expect(day.slots[0]).toEqual({ time: "09:00", staff: ["Mia"] });
    expect(day.slots.at(-1)!.time).toBe("10:00");
  });

  it("upisuje termin označen kao chat i vezan za razgovor", async () => {
    const r = await call("book_appointment", {
      service_ids: [haircut], staff_id: null, date: tuesday, time: "09:00",
      client_name: "Ena Test", client_phone: "061 321 654", notes: null, additional_booking: false,
    });
    expect(r).toMatchObject({ booked: true, start: "09:00", end: "10:00", staff: "Mia" });
    const appt = await db.query.appointments.findFirst({ where: eq(appointments.conversationId, ctx.conversationId) });
    expect(appt?.source).toBe("chat");
  });

  it("ne može upisati zauzet termin — vraća grešku koju AI objašnjava", async () => {
    const r = await call("book_appointment", {
      service_ids: [haircut], staff_id: mia, date: tuesday, time: "09:30",
      client_name: "Drugi", client_phone: "061 999 000", notes: null, additional_booking: true,
    });
    expect(r.code).toBe("SLOT_TAKEN");
  });

  it("pronalazi i otkazuje termin samo uz tačan broj telefona", async () => {
    const found = await call("find_client_appointments", { phone: "+38761321654" });
    const [appt] = found.appointments as { appointment_id: string; start: string }[];
    expect(appt.start).toBe("09:00");

    const wrong = await call("cancel_appointment", { appointment_id: appt.appointment_id, phone: "061 000 111", reason: null });
    expect(wrong.code).toBe("NOT_FOUND");

    const ok = await call("cancel_appointment", { appointment_id: appt.appointment_id, phone: "061 321 654", reason: "Bolesna" });
    expect(ok).toEqual({ cancelled: true });
  });

  it("odbija neispravne argumente bez rušenja", async () => {
    const r = await call("book_appointment", { service_ids: ["nije-uuid"], staff_id: null, date: "sutra", time: "9", client_name: "X", client_phone: "1", notes: null, additional_booking: false });
    expect(r.error).toBeTruthy();
  });
});

// Scenarij iz stvarnog testa: AI je ponudio 15:00, a upisao 09:35 i zatim napravio drugi termin.
describe("zaštite od grešaka AI-ja", () => {
  let thursday = addDays(tuesday, 2);
  let ctx2: ToolContext;
  let firstId: string;
  const book = (time: string, additional = false) =>
    runTool(ctx2, "book_appointment", JSON.stringify({
      service_ids: [haircut], staff_id: null, date: thursday, time,
      client_name: "Marko Test", client_phone: "066 555 555", notes: null, additional_booking: additional,
    })).then((r) => r.result as Record<string, unknown>);

  beforeAll(async () => {
    while (isoWeekday(thursday) !== 4) thursday = addDays(thursday, 1);
    const conv = await getOrCreateConversation(salon.id, "chat", crypto.randomUUID());
    ctx2 = { ...ctx, conversationId: conv.id, offeredTimes: new Set(["10:00"]) };
  });

  it("ne upisuje vrijeme koje klijentu nije ponuđeno", async () => {
    const r = await book("09:00");
    expect(r.code).toBe("NOT_OFFERED");
  });

  it("upisuje ponuđeno vrijeme", async () => {
    const r = await book("10:00");
    expect(r).toMatchObject({ booked: true, start: "10:00" });
  });

  it("ne pravi drugi termin u istom razgovoru bez izričitog zahtjeva", async () => {
    ctx2.offeredTimes.add("11:30");
    const r = await book("11:30");
    expect(r.code).toBe("ALREADY_BOOKED");
    firstId = (r.existing as { appointment_id: string }[])[0].appointment_id;
  });

  it("pomjera postojeći termin umjesto novog", async () => {
    const r = (await runTool(ctx2, "reschedule_appointment", JSON.stringify({
      appointment_id: firstId, phone: "066 555 555", date: thursday, time: "11:30", staff_id: null,
    }))).result as Record<string, unknown>;
    expect(r).toMatchObject({ rescheduled: true, start: "11:30", end: "12:30", staff: "Mia" });
    const active = await db.query.appointments.findMany({
      where: and(eq(appointments.conversationId, ctx2.conversationId), inArray(appointments.status, ["booked", "confirmed"])),
    });
    expect(active).toHaveLength(1);
    expect(toLocalMinutes(active[0].startsAt, TZ)).toBe(11 * 60 + 30);
  });

  it("ni pomjeranje ne prihvata neponuđeno vrijeme", async () => {
    const r = (await runTool(ctx2, "reschedule_appointment", JSON.stringify({
      appointment_id: firstId, phone: "066 555 555", date: thursday, time: "09:00", staff_id: null,
    }))).result as Record<string, unknown>;
    expect(r, JSON.stringify(r)).toMatchObject({ code: "NOT_OFFERED" });
  });

  it("dodatni termin je dozvoljen kad ga klijent izričito traži", async () => {
    ctx2.offeredTimes.add("09:00");
    const r = await book("09:00", true);
    expect(r.booked).toBe(true);
  });
});
