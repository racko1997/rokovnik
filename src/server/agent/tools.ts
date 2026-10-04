// Alati AI recepcionera. Svaki alat je tanak omotač oko servisnog sloja —
// ista pravila kao dashboard i javna stranica. AI vidi samo rezultat (JSON).
import { z } from "zod";
import { formatPhone } from "@/lib/phone";
import { isLocalDate, toLocalDate, toLocalMinutes, zonedToUtc } from "../domain/time";
import { DomainError } from "../errors";
import { cancelByClient, createAppointment, getAvailability, listUpcomingByPhone } from "../services/booking";
import type { Salon } from "../services/salons";
import { type Channel, updateConversation } from "./conversations";

export interface ToolContext {
  salon: Salon;
  conversationId: string;
  channel: Channel;
  staffName: Map<string, string>;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const parseHHMM = (v: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new DomainError("INVALID_INPUT", `Neispravno vrijeme: ${v}`);
  return Number(m[1]) * 60 + Number(m[2]);
};
const date = z.string().refine(isLocalDate, "Datum mora biti u formatu YYYY-MM-DD.");

interface ToolDef<S extends z.ZodType> {
  description: string;
  schema: S;
  /** JSON shema za OpenAI (strict: sva polja obavezna, opcionalna su nullable). */
  parameters: Record<string, unknown>;
  run: (ctx: ToolContext, args: z.output<S>) => Promise<unknown>;
}

const define = <S extends z.ZodType>(def: ToolDef<S>) => def;

const nullableString = { type: ["string", "null"] };
const serviceIds = { type: "array", items: { type: "string" }, description: "ID-jevi usluga iz cjenovnika, redom kojim se rade." };

export const TOOLS = {
  find_available_slots: define({
    description:
      "Slobodni termini za jednu ili više usluga. Zovi UVIJEK prije nego ponudiš vrijeme. Vraća po danima listu početaka (HH:MM) i ko je slobodan.",
    schema: z.object({
      service_ids: z.array(z.string()).min(1),
      staff_id: z.string().nullable(),
      date_from: date,
      days: z.number().int().min(1).max(14),
    }),
    parameters: {
      type: "object",
      properties: {
        service_ids: serviceIds,
        staff_id: { ...nullableString, description: "ID radnika ako klijent želi određenog, inače null." },
        date_from: { type: "string", description: "Prvi dan pretrage, YYYY-MM-DD." },
        days: { type: "integer", description: "Broj dana od date_from (1–14). Za konkretan dan 1, za 'ove sedmice' 7." },
      },
      required: ["service_ids", "staff_id", "date_from", "days"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const days = await getAvailability(
        ctx.salon,
        { serviceIds: args.service_ids, staffId: args.staff_id ?? undefined, from: args.date_from, days: args.days },
        { mode: "public" },
      );
      return {
        days: days
          .filter((d) => d.slots.length)
          .map((d) => ({
            date: d.date,
            // Dovoljno za izbor; AI ionako nudi 2–3
            slots: d.slots.slice(0, 24).map((s) => ({
              time: hhmm(toLocalMinutes(new Date(s.start), ctx.salon.timezone)),
              staff: s.staffIds.map((id) => ctx.staffName.get(id) ?? id),
            })),
            more: Math.max(0, d.slots.length - 24),
          })),
        no_slots_on: days.filter((d) => !d.slots.length).map((d) => d.date),
      };
    },
  }),

  book_appointment: define({
    description:
      "Upisuje termin. Zovi tek kad klijent prihvati konkretan termin i kad imaš ime i broj telefona. Vraća potvrdu ili grešku (npr. termin je u međuvremenu zauzet).",
    schema: z.object({
      service_ids: z.array(z.string()).min(1),
      staff_id: z.string().nullable(),
      date,
      time: z.string(),
      client_name: z.string().min(2),
      client_phone: z.string().min(6),
      notes: z.string().nullable(),
    }),
    parameters: {
      type: "object",
      properties: {
        service_ids: serviceIds,
        staff_id: { ...nullableString, description: "Radnik iz ponuđenog termina, ili null za bilo koga slobodnog." },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM, tačno kako je vratio find_available_slots." },
        client_name: { type: "string" },
        client_phone: { type: "string", description: "Broj telefona kako ga je klijent napisao." },
        notes: { ...nullableString, description: "Kratka napomena za salon (npr. dužina kose), ili null." },
      },
      required: ["service_ids", "staff_id", "date", "time", "client_name", "client_phone", "notes"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const res = await createAppointment(
        ctx.salon,
        {
          serviceIds: args.service_ids,
          staffId: args.staff_id ?? undefined,
          startsAt: zonedToUtc(args.date, parseHHMM(args.time), ctx.salon.timezone),
          client: { name: args.client_name, phone: args.client_phone },
          notes: args.notes ?? undefined,
          source: ctx.channel,
          conversationId: ctx.conversationId,
        },
        { mode: "public" },
      );
      await updateConversation(ctx.conversationId, { clientId: res.clientId });
      return {
        booked: true,
        date: toLocalDate(res.startsAt, ctx.salon.timezone),
        start: hhmm(toLocalMinutes(res.startsAt, ctx.salon.timezone)),
        end: hhmm(toLocalMinutes(res.endsAt, ctx.salon.timezone)),
        staff: ctx.staffName.get(res.staffId),
      };
    },
  }),

  find_client_appointments: define({
    description: "Budući termini klijenta po broju telefona s kojim je zakazivao. Koristi za otkazivanje ili provjeru termina.",
    schema: z.object({ phone: z.string().min(6) }),
    parameters: {
      type: "object",
      properties: { phone: { type: "string" } },
      required: ["phone"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const list = await listUpcomingByPhone(ctx.salon.id, args.phone);
      return {
        phone: formatPhone(args.phone),
        appointments: list.map((a) => ({
          appointment_id: a.appointmentId,
          date: toLocalDate(a.startsAt, ctx.salon.timezone),
          start: hhmm(toLocalMinutes(a.startsAt, ctx.salon.timezone)),
          services: a.services,
          staff: a.staffIds.map((id) => ctx.staffName.get(id) ?? id),
        })),
      };
    },
  }),

  cancel_appointment: define({
    description: "Otkazuje termin klijenta. Zovi tek kad klijent potvrdi koji termin otkazuje.",
    schema: z.object({ appointment_id: z.string(), phone: z.string().min(6), reason: z.string().nullable() }),
    parameters: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "Iz find_client_appointments." },
        phone: { type: "string" },
        reason: { ...nullableString, description: "Razlog ako ga je klijent naveo, inače null." },
      },
      required: ["appointment_id", "phone", "reason"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      await cancelByClient(ctx.salon.id, args.appointment_id, args.phone, args.reason ?? undefined);
      return { cancelled: true };
    },
  }),

  handoff_to_staff: define({
    description:
      "Prebacuje razgovor osoblju salona: kad ne znaš odgovor, kad klijent traži čovjeka, reklamacije, zdravstvena pitanja ili posebni dogovori.",
    schema: z.object({ reason: z.string() }),
    parameters: {
      type: "object",
      properties: { reason: { type: "string", description: "Kratko za osoblje: šta klijent treba." } },
      required: ["reason"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      await updateConversation(ctx.conversationId, { status: "handoff", handoffReason: args.reason });
      return { handed_off: true, salon_phone: ctx.salon.phone };
    },
  }),
} as const;

export type ToolName = keyof typeof TOOLS;

export function openAiToolDefinitions() {
  return Object.entries(TOOLS).map(([name, t]) => ({
    type: "function" as const,
    name,
    description: t.description,
    parameters: t.parameters,
    strict: true,
  }));
}

/** Izvršava alat; greške vraća kao rezultat da ih AI objasni klijentu. */
export async function runTool(ctx: ToolContext, name: string, rawArgs: string): Promise<{ args: unknown; result: unknown }> {
  const tool = TOOLS[name as ToolName];
  let args: unknown = null;
  try {
    args = JSON.parse(rawArgs || "{}");
    if (!tool) return { args, result: { error: `Nepoznat alat: ${name}` } };
    const parsed = tool.schema.parse(args);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { args, result: await (tool.run as any)(ctx, parsed) };
  } catch (err) {
    if (err instanceof DomainError) return { args, result: { error: err.message, code: err.code } };
    if (err instanceof z.ZodError) return { args, result: { error: "Neispravni argumenti.", details: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) } };
    console.error(`[agent] alat ${name} pao`, err);
    return { args, result: { error: "Greška u sistemu. Ponudi klijentu da pozove salon." } };
  }
}
