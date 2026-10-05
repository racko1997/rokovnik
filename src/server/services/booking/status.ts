// Promjena statusa (potvrđeno, završeno, otkazano…).
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { appointmentItems, appointments } from "../../db/schema";
import { DomainError, isExclusionViolation } from "../../errors";
import { type Status } from "./shared";

// ─── Izmjene ─────────────────────────────────────────────────────────────────

export async function setAppointmentStatus(
  salonId: string,
  appointmentId: string,
  status: Status,
  opts: { reason?: string } = {},
) {
  await db.transaction(async (tx) => {
    const cancelled = status === "cancelled";
    const updated = await tx
      .update(appointments)
      .set({
        status,
        cancelledAt: cancelled ? new Date() : null,
        cancelReason: cancelled ? (opts.reason ?? null) : null,
      })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.salonId, salonId)))
      .returning({ id: appointments.id });
    if (!updated.length) throw new DomainError("NOT_FOUND", "Termin ne postoji.");
    try {
      await tx
        .update(appointmentItems)
        .set({ active: !cancelled })
        .where(eq(appointmentItems.appointmentId, appointmentId));
    } catch (err) {
      // Vraćanje otkazanog termina koji je u međuvremenu neko drugi zauzeo
      if (isExclusionViolation(err)) {
        throw new DomainError("SLOT_TAKEN", "Termin je u međuvremenu zauzet, ne može se vratiti.");
      }
      throw err;
    }
  });
}
