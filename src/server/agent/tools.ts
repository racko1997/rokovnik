// Alati AI recepcionera. Svaki alat je tanak omotač oko servisnog sloja —
// ista pravila kao dashboard i javna stranica. AI vidi samo rezultat (JSON).
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { formatPhone } from "@/lib/phone";
import { isLocalDate, toLocalDate, toLocalMinutes, zonedToUtc } from "../domain/time";
import { DomainError } from "../errors";
import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { appointments } from "../db/schema";
import { manageUrl } from "../manage-link";
import {
  cancelByClient,
  createAppointment,
  getAvailability,
  listUpcomingByPhone,
  notifyBookingLater,
  rescheduleByClient,
} from "../services/booking";
import type { Salon } from "../services/salons";
import { type Channel, updateConversation } from "./conversations";

export interface ToolContext {
  salon: Salon;
  conversationId: string;
  channel: Channel;
  staffName: Map<string, string>;
  /** Vremena (HH:MM) koja je recepcioner već napisao klijentu u ovom razgovoru */
  offeredTimes: Set<string>;
}

/** Sva vremena HH:MM spomenuta u tekstu ("9:35" → "09:35"). Datumi poput "5.10." se ne broje. */
export function extractTimes(text: string): string[] {
  return [...text.matchAll(/\b([01]?\d|2[0-3])[:]([0-5]\d)\b/g)].map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
}

/**
 * AI smije upisati samo vrijeme koje je klijentu prethodno napisao i koje je
 * klijent mogao potvrditi. Sprječava da model "sam izabere" drugo vrijeme.
 */
function assertOffered(ctx: ToolContext, time: string) {
  const [h, m] = time.trim().split(":");
  const normalized = `${(h ?? "").padStart(2, "0")}:${m ?? ""}`;
  if (!ctx.offeredTimes.has(normalized)) {
    throw new DomainError(
      "NOT_OFFERED",
      `Vrijeme ${normalized} klijentu nije ponuđeno u razgovoru. Prvo mu napiši tačno to vrijeme (dan, sat, radnik) i sačekaj potvrdu — ne mijenjaj dogovoreno vrijeme samoinicijativno.`,
    );
  }
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
      additional_booking: z.boolean(),
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
        additional_booking: {
          type: "boolean",
          description:
            "true samo ako klijent IZRIČITO želi još jedan, dodatni termin uz već zakazani (npr. za drugu osobu). Za promjenu vremena koristi reschedule_appointment.",
        },
      },
      required: ["service_ids", "staff_id", "date", "time", "client_name", "client_phone", "notes", "additional_booking"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      assertOffered(ctx, args.time);
      if (!args.additional_booking) {
        const existing = await db
          .select({ id: appointments.id, startsAt: appointments.startsAt })
          .from(appointments)
          .where(
            and(
              eq(appointments.conversationId, ctx.conversationId),
              inArray(appointments.status, ["booked", "confirmed"]),
              gt(appointments.startsAt, new Date()),
            ),
          );
        if (existing.length) {
          return {
            error:
              "Klijent u ovom razgovoru već ima zakazan termin. Ako želi drugo vrijeme, pomjeri postojeći (reschedule_appointment). Novi termin upiši samo ako izričito traži dodatni (additional_booking = true).",
            code: "ALREADY_BOOKED",
            existing: existing.map((e) => ({
              appointment_id: e.id,
              date: toLocalDate(e.startsAt, ctx.salon.timezone),
              start: hhmm(toLocalMinutes(e.startsAt, ctx.salon.timezone)),
            })),
          };
        }
      }
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
      notifyBookingLater(res.appointmentId, "created", { source: ctx.channel });
      return {
        booked: true,
        manage_link: manageUrl(res.appointmentId),
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

  reschedule_appointment: define({
    description:
      "Pomjera POSTOJEĆI termin klijenta na novo vrijeme (umjesto otkazivanja i novog upisa). Zovi kad klijent potvrdi novo vrijeme koje si mu ponudio.",
    schema: z.object({
      appointment_id: z.string(),
      phone: z.string().min(6),
      date,
      time: z.string(),
      staff_id: z.string().nullable(),
    }),
    parameters: {
      type: "object",
      properties: {
        appointment_id: { type: "string", description: "Iz find_client_appointments ili iz greške ALREADY_BOOKED." },
        phone: { type: "string", description: "Broj s kojim je termin zakazan." },
        date: { type: "string", description: "Novi datum, YYYY-MM-DD." },
        time: { type: "string", description: "Novo vrijeme HH:MM, tačno kako je ponuđeno klijentu." },
        staff_id: { ...nullableString, description: "Novi radnik ako se mijenja, inače null (ostaje isti ako je slobodan)." },
      },
      required: ["appointment_id", "phone", "date", "time", "staff_id"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      assertOffered(ctx, args.time);
      const before = (await listUpcomingByPhone(ctx.salon.id, args.phone)).find((a) => a.appointmentId === args.appointment_id);
      const res = await rescheduleByClient(ctx.salon, {
        appointmentId: args.appointment_id,
        phone: args.phone,
        startsAt: zonedToUtc(args.date, parseHHMM(args.time), ctx.salon.timezone),
        staffId: args.staff_id ?? undefined,
      });
      notifyBookingLater(args.appointment_id, "rescheduled", { previousStart: before?.startsAt });
      return {
        rescheduled: true,
        manage_link: manageUrl(args.appointment_id),
        date: toLocalDate(res.startsAt, ctx.salon.timezone),
        start: hhmm(toLocalMinutes(res.startsAt, ctx.salon.timezone)),
        end: hhmm(toLocalMinutes(res.endsAt, ctx.salon.timezone)),
        staff: ctx.staffName.get(res.staffId),
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
      notifyBookingLater(args.appointment_id, "cancelled");
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
    Sentry.captureException(err, { tags: { area: "agent", tool: name } });
    return { args, result: { error: "Greška u sistemu. Ponudi klijentu da pozove salon." } };
  }
}
