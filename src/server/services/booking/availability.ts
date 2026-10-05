// Slobodni termini — isti za recepciju, online stranicu i AI recepcionera.
import { z } from "zod";
import { db } from "../../db/client";
import { findSlots } from "../../domain/availability";
import { dayBounds, isLocalDate, type LocalDate } from "../../domain/time";
import type { Salon } from "../salons";
import {
  bookingWindow,
  busySegments,
  eligibleStaffIds,
  loadServices,
  loadStaffDays,
  totalBlockMin,
  type BookingMode,
} from "./shared";

// ─── Slobodni termini ────────────────────────────────────────────────────────

export const availabilityQuery = z.object({
  serviceIds: z.array(z.uuid()).min(1),
  /** Konkretan radnik ili bilo ko slobodan. */
  staffId: z.uuid().optional(),
  from: z.string().refine(isLocalDate, "Neispravan datum."),
  days: z.number().int().min(1).max(31).default(1),
});

export interface DayAvailability {
  date: LocalDate;
  slots: { start: string; staffIds: string[] }[];
}

export async function getAvailability(
  salon: Salon,
  raw: z.input<typeof availabilityQuery>,
  opts: { mode: BookingMode; now?: Date },
): Promise<DayAvailability[]> {
  const q = availabilityQuery.parse(raw);
  const now = opts.now ?? new Date();
  const list = await loadServices(db, salon.id, q.serviceIds, opts.mode);
  const staffIds = await eligibleStaffIds(db, salon.id, q.serviceIds, opts.mode, q.staffId);
  const { earliest, lastDate } = bookingWindow(salon, opts.mode, now);

  const days = await loadStaffDays(db, salon, staffIds, q.from, q.days);
  const duration = totalBlockMin(list);

  return [...days.entries()].map(([date, staffDays]) => {
    if (lastDate && date > lastDate) return { date, slots: [] };
    const slots = findSlots({
      staff: staffDays,
      durationMin: duration,
      segments: busySegments(list),
      stepMin: salon.slotIntervalMin,
      gridOrigin: dayBounds(date, salon.timezone).start.getTime(),
      earliest,
    });
    return {
      date,
      slots: slots.map((s) => ({ start: new Date(s.start).toISOString(), staffIds: s.staffIds })),
    };
  });
}
