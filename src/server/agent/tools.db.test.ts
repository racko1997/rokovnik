// Alati AI recepcionera nad pravom bazom, bez OpenAI-ja: provjerava da AI dobija
// tačne podatke i da ne može zaobići pravila zakazivanja.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { appointments, salons } from "../db/schema";
import { addDays, isoWeekday, toLocalDate } from "../domain/time";
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
  mia = await saveStaff(salon.id, null, { name: "Mia", color: "rubin", hours: [{ weekday: 2, startMin: 9 * 60, endMin: 11 * 60 }] });
  haircut = await saveService(salon.id, null, { name: "Šišanje", durationMin: 60, price: 25, staffIds: [mia] });
  const conv = await getOrCreateConversation(salon.id, "chat", crypto.randomUUID());
  ctx = { salon, conversationId: conv.id, channel: "chat", staffName: new Map([[mia, "Mia"]]) };
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
      client_name: "Ena Test", client_phone: "061 321 654", notes: null,
    });
    expect(r).toMatchObject({ booked: true, start: "09:00", end: "10:00", staff: "Mia" });
    const appt = await db.query.appointments.findFirst({ where: eq(appointments.conversationId, ctx.conversationId) });
    expect(appt?.source).toBe("chat");
  });

  it("ne može upisati zauzet termin — vraća grešku koju AI objašnjava", async () => {
    const r = await call("book_appointment", {
      service_ids: [haircut], staff_id: mia, date: tuesday, time: "09:30",
      client_name: "Drugi", client_phone: "061 999 000", notes: null,
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
    const r = await call("book_appointment", { service_ids: ["nije-uuid"], staff_id: null, date: "sutra", time: "9", client_name: "X", client_phone: "1", notes: null });
    expect(r.error).toBeTruthy();
  });
});
