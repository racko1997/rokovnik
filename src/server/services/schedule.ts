// Stvarno radno vrijeme radnika za konkretan dan.
// Ovo je JEDINO mjesto koje odlučuje "kad X radi tog datuma". Redoslijed:
//   1. izmjena za taj dan (najjača — npr. radi i na praznik)
//   2. neradni dan salona
//   3. redovni raspored (uz izmjenu sedmica A/B ako smjene rotiraju)
// Online zakazivanje, kalendar, konflikti i AI recepcioner svi idu kroz ovu funkciju.
import { and, asc, between, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "../db/client";
import { salonClosures, staff, staffDayOverrides, workingHours } from "../db/schema";
import { addDays, isLocalDate, isoWeekday, type LocalDate } from "../domain/time";
import { DomainError } from "../errors";

export interface DayShift {
  startMin: number;
  endMin: number;
}

export interface DaySchedule {
  shifts: DayShift[];
  /** Šta bi važilo po redovnom rasporedu (za poređenje u prikazu) */
  regular: DayShift[];
  /** regular = redovni raspored, override = izmjena za taj dan, closed = salon ne radi */
  source: "regular" | "override" | "closed";
  note: string | null;
  /** Sedmica A (0) ili B (1) za radnike čije smjene rotiraju; inače null */
  rotationWeek: 0 | 1 | null;
}

/** Ponedjeljak sedmice u kojoj je datum. */
export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** 0 = sedmica A, 1 = sedmica B, računato od ponedjeljka sedmice A. */
export function rotationWeekIndex(anchor: LocalDate, date: LocalDate): 0 | 1 {
  const ms = Date.parse(`${mondayOf(date)}T00:00:00Z`) - Date.parse(`${mondayOf(anchor)}T00:00:00Z`);
  const weeks = Math.round(ms / (7 * 86_400_000));
  return (((weeks % 2) + 2) % 2) as 0 | 1;
}

/** staffId → datum → raspored tog dana */
export type ScheduleMap = Map<string, Map<LocalDate, DaySchedule>>;

export async function loadSchedules(
  tx: Tx,
  staffIds: string[],
  from: LocalDate,
  days: number,
): Promise<ScheduleMap> {
  const result: ScheduleMap = new Map();
  if (!staffIds.length) return result;
  const to = addDays(from, days - 1);

  const [members, hours, overrides] = await Promise.all([
    tx
      .select({ id: staff.id, salonId: staff.salonId, rotationWeeks: staff.rotationWeeks, rotationAnchor: staff.rotationAnchor })
      .from(staff)
      .where(inArray(staff.id, staffIds)),
    tx.select().from(workingHours).where(inArray(workingHours.staffId, staffIds)),
    tx
      .select()
      .from(staffDayOverrides)
      .where(and(inArray(staffDayOverrides.staffId, staffIds), between(staffDayOverrides.date, from, to))),
  ]);
  const salonIds = [...new Set(members.map((m) => m.salonId))];
  const closures = salonIds.length
    ? await tx
        .select()
        .from(salonClosures)
        .where(and(inArray(salonClosures.salonId, salonIds), lte(salonClosures.startDate, to), gte(salonClosures.endDate, from)))
    : [];

  for (const member of members) {
    const perDay = new Map<LocalDate, DaySchedule>();
    const rotates = member.rotationWeeks === 2 && member.rotationAnchor;
    for (let i = 0; i < days; i++) {
      const date = addDays(from, i);
      const weekday = isoWeekday(date);
      const week = rotates ? rotationWeekIndex(member.rotationAnchor!, date) : 0;
      const regular = sortShifts(
        hours
          .filter((h) => h.staffId === member.id && h.weekday === weekday && h.week === week)
          .map(({ startMin, endMin }) => ({ startMin, endMin })),
      );
      const rotationWeek = rotates ? week : null;

      const override = overrides.find((o) => o.staffId === member.id && o.date === date);
      if (override) {
        perDay.set(date, { shifts: sortShifts(override.shifts), regular, source: "override", note: override.note, rotationWeek });
        continue;
      }
      const closure = closures.find((c) => c.salonId === member.salonId && c.startDate <= date && date <= c.endDate);
      if (closure) {
        perDay.set(date, { shifts: [], regular, source: "closed", note: closure.reason, rotationWeek });
        continue;
      }
      perDay.set(date, { shifts: regular, regular, source: "regular", note: null, rotationWeek });
    }
    result.set(member.id, perDay);
  }
  return result;
}

const sortShifts = (s: DayShift[]) => [...s].sort((a, b) => a.startMin - b.startMin);

// ─── Validacija smjena (zajednička za redovni raspored i izmjene) ───────────

export const shiftSchema = z
  .object({ startMin: z.number().int().min(0).max(1440), endMin: z.number().int().min(0).max(1440) })
  .refine((s) => s.startMin < s.endMin, "Početak smjene mora biti prije kraja.");

export function shiftsOverlap(shifts: DayShift[]): boolean {
  const sorted = sortShifts(shifts);
  return sorted.some((s, i) => i > 0 && s.startMin < sorted[i - 1].endMin);
}

// ─── Izmjene za jedan dan ────────────────────────────────────────────────────

export const dayOverrideInput = z
  .object({
    staffId: z.uuid(),
    date: z.string().refine(isLocalDate, "Neispravan datum."),
    /** [] = slobodan dan */
    shifts: z.array(shiftSchema).max(6),
    note: z
      .string()
      .trim()
      .max(120)
      .nullish()
      .transform((v) => v || null),
  })
  .refine((v) => !shiftsOverlap(v.shifts), "Smjene istog dana se preklapaju.");

export async function setDayOverride(salonId: string, raw: z.input<typeof dayOverrideInput>) {
  const input = dayOverrideInput.parse(raw);
  await assertStaff(salonId, input.staffId);
  await db
    .insert(staffDayOverrides)
    .values({ salonId, staffId: input.staffId, date: input.date, shifts: input.shifts, note: input.note })
    .onConflictDoUpdate({
      target: [staffDayOverrides.staffId, staffDayOverrides.date],
      set: { shifts: input.shifts, note: input.note },
    });
}

/** Vraća dan na redovni raspored. */
export async function clearDayOverride(salonId: string, staffId: string, date: LocalDate) {
  await db
    .delete(staffDayOverrides)
    .where(and(eq(staffDayOverrides.salonId, salonId), eq(staffDayOverrides.staffId, staffId), eq(staffDayOverrides.date, date)));
}

async function assertStaff(salonId: string, staffId: string) {
  const row = await db.query.staff.findFirst({ where: and(eq(staff.id, staffId), eq(staff.salonId, salonId)) });
  if (!row) throw new DomainError("NOT_FOUND", "Radnik ne postoji.");
}

// ─── Neradni dani salona ─────────────────────────────────────────────────────

export const closureInput = z
  .object({
    startDate: z.string().refine(isLocalDate, "Neispravan datum."),
    endDate: z.string().refine(isLocalDate, "Neispravan datum."),
    reason: z
      .string()
      .trim()
      .max(80)
      .nullish()
      .transform((v) => v || null),
  })
  .refine((v) => v.startDate <= v.endDate, "Kraj mora biti isti ili poslije početka.");

export async function addClosure(salonId: string, raw: z.input<typeof closureInput>) {
  const input = closureInput.parse(raw);
  await db.insert(salonClosures).values({ salonId, ...input });
  return input;
}

export async function removeClosure(salonId: string, id: string) {
  await db.delete(salonClosures).where(and(eq(salonClosures.id, id), eq(salonClosures.salonId, salonId)));
}

export async function listClosures(salonId: string, fromDate: LocalDate) {
  return db
    .select()
    .from(salonClosures)
    .where(and(eq(salonClosures.salonId, salonId), gte(salonClosures.endDate, fromDate)))
    .orderBy(asc(salonClosures.startDate));
}
