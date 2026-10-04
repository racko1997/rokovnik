import "server-only";
import { formatPhone } from "@/lib/phone";
import { suggestReassignment, type ScheduleConflict } from "@/server/services/booking";
import type { Salon } from "@/server/services/salons";

export type ConflictWithSuggestions = ScheduleConflict & { suggestions: string[]; phoneDisplay: string | null };

/** Uz svaki konflikt: koji radnici su slobodni i rade te usluge u isto vrijeme. */
export async function withSuggestions(salon: Salon, conflicts: ScheduleConflict[]): Promise<ConflictWithSuggestions[]> {
  return Promise.all(
    conflicts.slice(0, 40).map(async (c) => ({
      ...c,
      phoneDisplay: c.client?.phone ? formatPhone(c.client.phone) : null,
      suggestions: await suggestReassignment(salon, c.appointmentId, c.staffId),
    })),
  );
}
