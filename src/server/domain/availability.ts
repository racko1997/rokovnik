// Računanje slobodnih termina — čista funkcija, bez baze i bez AI.
// Isti kod koriste online zakazivanje, recepcija u dashboardu i (kasnije)
// AI recepcioner preko alata. AI nikad ne "pogađa" slobodne termine.

/** Vremenski interval u epoch milisekundama, [start, end). */
export interface Interval {
  start: number;
  end: number;
}

export interface StaffDay {
  staffId: string;
  /** Smjene tog dana (već pretvorene u trenutke). */
  shifts: Interval[];
  /** Zauzeto: postojeći termini (do blockedUntil) i odsustva. */
  busy: Interval[];
}

/**
 * Dio usluge u kojem je radnik zauzet, u minutama od početka termina.
 * Usluga bez vremena djelovanja ima jedan dio; s djelovanjem dva (prije i poslije).
 */
export interface BusySegment {
  offsetMin: number;
  durationMin: number;
}

export interface SlotQuery {
  staff: StaffDay[];
  /** Ukupno vrijeme koje radnik mora imati slobodno (usluge + bufferi), bez rupa. */
  durationMin: number;
  /**
   * Dijelovi u kojima je radnik zauzet. Bez ovoga: jedan dio cijelog trajanja.
   * Između dijelova (vrijeme djelovanja) radnik smije imati drugog klijenta.
   */
  segments?: BusySegment[];
  /** Korak mreže termina (npr. 15 min). */
  stepMin: number;
  /** Početak lokalnog dana — mreža termina se ravna po njemu (09:00, 09:15…). */
  gridOrigin: number;
  /** Najraniji dozvoljeni početak (npr. sada + 60 min). */
  earliest?: number;
}

export interface Slot {
  start: number;
  /** Radnici koji su slobodni u tom terminu, redoslijedom iz upita. */
  staffIds: string[];
}

const MIN = 60_000;

/** Spaja preklapajuće intervale i sortira ih. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ ...cur });
  }
  return out;
}

/** Oduzima zauzete intervale od slobodnih. */
export function subtractIntervals(free: Interval[], busy: Interval[]): Interval[] {
  const blocks = mergeIntervals(busy);
  const out: Interval[] = [];
  for (const f of mergeIntervals(free)) {
    let cursor = f.start;
    for (const b of blocks) {
      if (b.end <= cursor || b.start >= f.end) continue;
      if (b.start > cursor) out.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
      if (cursor >= f.end) break;
    }
    if (cursor < f.end) out.push({ start: cursor, end: f.end });
  }
  return out;
}

/** Slobodni prozori jednog radnika. */
export function freeWindows(day: StaffDay): Interval[] {
  return subtractIntervals(day.shifts, day.busy);
}

/**
 * Svi mogući počeci za traženo trajanje.
 *
 * Kandidati su tačke mreže (svakih `stepMin` od početka dana) plus početak
 * svakog slobodnog prozora — tako termin može krenuti odmah nakon prethodnog
 * (npr. u 10:40), bez rupa u rasporedu.
 */
export function findSlots(q: SlotQuery): Slot[] {
  const step = q.stepMin * MIN;
  const segments = (q.segments?.length ? q.segments : [{ offsetMin: 0, durationMin: q.durationMin }])
    .filter((g) => g.durationMin > 0)
    .map((g) => ({ offset: g.offsetMin * MIN, duration: g.durationMin * MIN }));
  if (!segments.length || step <= 0) return [];
  const earliest = q.earliest ?? -Infinity;

  const byStart = new Map<number, string[]>();

  for (const day of q.staff) {
    const windows = freeWindows(day);
    if (!windows.length) continue;
    const fits = (t: number) =>
      segments.every((g) => windows.some((w) => w.start <= t + g.offset && t + g.offset + g.duration <= w.end));

    // Kandidati: tačke mreže + trenuci kad neki dio usluge počinje tačno na početku
    // slobodnog prozora (npr. odmah nakon prethodnog termina) — bez rupa u rasporedu.
    const candidates = new Set<number>();
    for (const w of windows) for (const g of segments) candidates.add(w.start - g.offset);
    const first = windows[0].start - segments[segments.length - 1].offset;
    const last = windows[windows.length - 1].end;
    for (let t = q.gridOrigin + Math.ceil((first - q.gridOrigin) / step) * step; t < last; t += step) candidates.add(t);

    for (const t of candidates) {
      if (t < earliest || !fits(t)) continue;
      const list = byStart.get(t);
      if (list) list.push(day.staffId);
      else byStart.set(t, [day.staffId]);
    }
  }

  const order = new Map(q.staff.map((s, i) => [s.staffId, i]));
  return [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, staffIds]) => ({
      start,
      staffIds: staffIds.sort((a, b) => order.get(a)! - order.get(b)!),
    }));
}

/** Da li radnik ima slobodan cijeli interval (za provjeru prije upisa). */
export function isFree(day: StaffDay, interval: Interval): boolean {
  return freeWindows(day).some((w) => w.start <= interval.start && interval.end <= w.end);
}
