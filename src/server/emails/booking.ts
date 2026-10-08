// Mailovi o terminima — salonu (novi/otkazan/pomjeren) i klijentu (potvrda s linkom).
import { formatInstant } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

interface Details {
  salonName: string;
  timezone: string;
  startsAt: Date;
  services: string[];
  staff: string[];
  clientName: string | null;
  clientPhone: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  online: "online stranice",
  web_chat: "AI chata",
  instagram: "Instagrama",
  whatsapp: "WhatsAppa",
  viber: "Vibera",
};

const when = (d: Details) => formatInstant(d.startsAt, d.timezone, { time: true });
const what = (d: Details) => `${d.services.join(" + ")}${d.staff.length ? ` · ${d.staff.join(", ")}` : ""}`;
const who = (d: Details) => [d.clientName, d.clientPhone && formatPhone(d.clientPhone)].filter(Boolean).join(", ");

export type SalonEvent = "created" | "cancelled" | "rescheduled";

export function salonEventEmail(event: SalonEvent, d: Details, opts: { source?: string; calendarUrl: string; previousStart?: Date }) {
  const head =
    event === "created"
      ? `Novi termin preko ${SOURCE_LABEL[opts.source ?? ""] ?? "interneta"}`
      : event === "cancelled"
        ? "Klijent je otkazao termin"
        : "Klijent je pomjerio termin";
  const lines = [
    `${head}:`,
    "",
    `${when(d)} — ${what(d)}`,
    who(d) ? `Klijent: ${who(d)}` : "",
    event === "rescheduled" && opts.previousStart ? `Ranije: ${formatInstant(opts.previousStart, d.timezone, { time: true })}` : "",
    "",
    `Kalendar: ${opts.calendarUrl}`,
  ].filter((l, i, all) => l !== "" || (all[i - 1] ?? "") !== "");
  const subjectWho = d.clientName ? `${d.clientName}, ` : "";
  return {
    subject:
      event === "created"
        ? `Novi termin: ${subjectWho}${when(d)}`
        : event === "cancelled"
          ? `Otkazano: ${subjectWho}${when(d)}`
          : `Pomjereno: ${subjectWho}${when(d)}`,
    text: lines.join("\n"),
  };
}

export function clientConfirmationEmail(d: Details, manageUrl: string, event: "created" | "rescheduled") {
  return {
    subject: event === "created" ? `Termin u salonu ${d.salonName}: ${when(d)}` : `Novo vrijeme termina: ${when(d)}`,
    text: [
      d.clientName ? `Zdravo ${d.clientName.split(" ")[0]},` : "Zdravo,",
      "",
      event === "created" ? `vaš termin u salonu ${d.salonName} je zakazan:` : `vaš termin u salonu ${d.salonName} je pomjeren:`,
      `${when(d)} — ${what(d)}`,
      "",
      "Ako ne možete doći, otkažite ili pomjerite termin ovdje:",
      manageUrl,
      "",
      d.salonName,
    ].join("\n"),
  };
}
