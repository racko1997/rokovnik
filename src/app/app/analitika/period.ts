// Period izvještaja iz adrese (?p=mjesec, ?p=raspon&od=…&do=…), u lokalnim datumima salona.
import { MONTHS_GENITIVE } from "@/lib/format";
import { addDays, isLocalDate, isoWeekday, type LocalDate } from "@/server/domain/time";

export const PRESETS = [
  { key: "danas", label: "Danas" },
  { key: "sedmica", label: "Ova sedmica" },
  { key: "mjesec", label: "Ovaj mjesec" },
  { key: "prosli", label: "Prošli mjesec" },
] as const;

export type PeriodKey = (typeof PRESETS)[number]["key"] | "raspon";

const MAX_DAYS = 92;

const monthStart = (d: LocalDate) => `${d.slice(0, 7)}-01`;
const monthEnd = (d: LocalDate) => addDays(monthStart(addDays(monthStart(d), 32)), -1);

export function resolvePeriod(sp: { p?: string; od?: string; do?: string }, today: LocalDate) {
  const key: PeriodKey = (["danas", "sedmica", "mjesec", "prosli", "raspon"] as const).find((k) => k === sp.p) ?? "mjesec";
  if (key === "danas") return { key, from: today, to: today };
  if (key === "sedmica") {
    const from = addDays(today, 1 - isoWeekday(today));
    return { key, from, to: addDays(from, 6) };
  }
  if (key === "prosli") {
    const last = addDays(monthStart(today), -1);
    return { key, from: monthStart(last), to: last };
  }
  if (key === "raspon" && sp.od && sp.do && isLocalDate(sp.od) && isLocalDate(sp.do)) {
    const [from, to] = sp.od <= sp.do ? [sp.od, sp.do] : [sp.do, sp.od];
    // Najviše tri mjeseca odjednom
    const capped = addDays(from, MAX_DAYS - 1) < to ? addDays(from, MAX_DAYS - 1) : to;
    return { key, from, to: capped };
  }
  return { key: "mjesec" as const, from: monthStart(today), to: monthEnd(today) };
}

/** "1.–31. oktobra 2026", "28. septembra – 4. oktobra 2026", "5. oktobra 2026" */
export function periodLabel(from: LocalDate, to: LocalDate): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (from === to) return `${fd}. ${MONTHS_GENITIVE[fm - 1]} ${fy}`;
  if (fy === ty && fm === tm) return `${fd}.–${td}. ${MONTHS_GENITIVE[tm - 1]} ${ty}`;
  if (fy === ty) return `${fd}. ${MONTHS_GENITIVE[fm - 1]} – ${td}. ${MONTHS_GENITIVE[tm - 1]} ${ty}`;
  return `${fd}. ${MONTHS_GENITIVE[fm - 1]} ${fy} – ${td}. ${MONTHS_GENITIVE[tm - 1]} ${ty}`;
}
