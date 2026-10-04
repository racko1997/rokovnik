// Rad s vremenom u vremenskoj zoni salona.
// Pravilo: u bazi su trenuci (UTC), a radno vrijeme je u lokalnim minutama.
// Konverziju radimo samo ovdje, da bi prelazak na ljetno/zimsko vrijeme bio tačan.
import { TZDate } from "@date-fns/tz";

/** "2026-10-03" — kalendarski datum bez vremena. */
export type LocalDate = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseLocalDate(date: LocalDate): { y: number; m: number; d: number } {
  const match = DATE_RE.exec(date);
  if (!match) throw new Error(`Neispravan datum: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function isLocalDate(value: string): value is LocalDate {
  return DATE_RE.test(value);
}

/** Trenutak koji odgovara lokalnom datumu + minutama od ponoći u zoni `tz`. */
export function zonedToUtc(date: LocalDate, minutes: number, tz: string): Date {
  const { y, m, d } = parseLocalDate(date);
  const local = new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0, tz);
  return new Date(local.getTime());
}

/** ISO dan u sedmici: 1 = ponedjeljak … 7 = nedjelja. */
export function isoWeekday(date: LocalDate): number {
  const { y, m, d } = parseLocalDate(date);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { y, m, d } = parseLocalDate(date);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Lokalni datum trenutka u zoni `tz`. */
export function toLocalDate(instant: Date, tz: string): LocalDate {
  const z = new TZDate(instant.getTime(), tz);
  const mm = String(z.getMonth() + 1).padStart(2, "0");
  const dd = String(z.getDate()).padStart(2, "0");
  return `${z.getFullYear()}-${mm}-${dd}`;
}

/** Lokalne minute od ponoći za trenutak u zoni `tz`. */
export function toLocalMinutes(instant: Date, tz: string): number {
  const z = new TZDate(instant.getTime(), tz);
  return z.getHours() * 60 + z.getMinutes();
}

/** Početak i kraj lokalnog dana kao UTC trenuci (kraj = početak sljedećeg dana). */
export function dayBounds(date: LocalDate, tz: string): { start: Date; end: Date } {
  return { start: zonedToUtc(date, 0, tz), end: zonedToUtc(addDays(date, 1), 0, tz) };
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) throw new Error(`Neispravno vrijeme: ${hhmm}`);
  const total = Number(match[1]) * 60 + Number(match[2]);
  if (Number(match[2]) > 59 || total > 1440) throw new Error(`Neispravno vrijeme: ${hhmm}`);
  return total;
}
