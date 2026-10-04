// Formatiranje za prikaz (bs-BA). Bez zavisnosti od servera.

const CURRENCY_LABEL: Record<string, string> = { BAM: "KM", EUR: "€", RSD: "din" };

export function formatPrice(cents: number, currency = "BAM", from = false): string {
  const amount = cents / 100;
  const value = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace(".", ",");
  return `${from ? "od " : ""}${value} ${CURRENCY_LABEL[currency] ?? currency}`;
}

/** "45 min", "1 h 30 min" */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const WEEKDAYS = [
  { iso: 1, short: "Pon", long: "Ponedjeljak" },
  { iso: 2, short: "Uto", long: "Utorak" },
  { iso: 3, short: "Sri", long: "Srijeda" },
  { iso: 4, short: "Čet", long: "Četvrtak" },
  { iso: 5, short: "Pet", long: "Petak" },
  { iso: 6, short: "Sub", long: "Subota" },
  { iso: 7, short: "Ned", long: "Nedjelja" },
] as const;

export const MONTHS_GENITIVE = [
  "januara", "februara", "marta", "aprila", "maja", "juna",
  "jula", "augusta", "septembra", "oktobra", "novembra", "decembra",
];

/** "ponedjeljak, 5. oktobra" iz "2026-10-05" */
export function formatLocalDateLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const iso = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
  return `${WEEKDAYS[iso - 1].long.toLowerCase()}, ${d}. ${MONTHS_GENITIVE[m - 1]}`;
}

export function formatClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Bosanska množina: 1 usluga, 2–4 usluge, 5+ usluga (11–14 → usluga). */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
