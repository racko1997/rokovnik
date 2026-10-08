"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/action";
import { isLocalDate, zonedToUtc } from "@/server/domain/time";
import { DomainError } from "@/server/errors";
import { managePath } from "@/server/manage-link";
import { createAppointment, notifyBookingLater } from "@/server/services/booking";
import { getSalonBySlug } from "@/server/services/salons";

const publicBooking = z.object({
  serviceIds: z.array(z.uuid()).min(1),
  staffId: z.uuid().optional(),
  date: z.string().refine(isLocalDate),
  startMin: z.number().int().min(0).max(1439),
  name: z.string(),
  phone: z.string().trim().min(6, "Unesite broj telefona da vas salon može kontaktirati."),
  /** Nije obavezno — na njega ide potvrda s linkom za otkazivanje */
  email: z.union([z.email("Email nije ispravan."), z.literal("")]).optional(),
  notes: z.string().optional(),
  /** Polje koje ljudi ne vide — popunjavaju ga samo botovi. */
  website: z.string().optional(),
});

export async function bookPublicAction(slug: string, raw: z.input<typeof publicBooking>) {
  return runAction(async () => {
    const input = publicBooking.parse(raw);
    if (input.website) throw new DomainError("INVALID_INPUT", "Zahtjev je odbijen.");
    const salon = await getSalonBySlug(slug);
    if (!salon) throw new DomainError("NOT_FOUND", "Salon ne postoji.");

    const res = await createAppointment(
      salon,
      {
        serviceIds: input.serviceIds,
        staffId: input.staffId,
        startsAt: zonedToUtc(input.date, input.startMin, salon.timezone),
        client: { name: input.name, phone: input.phone, email: input.email },
        notes: input.notes,
        source: "online",
      },
      { mode: "public" },
    );
    revalidatePath("/app/kalendar");
    notifyBookingLater(res.appointmentId, "created", { source: "online" });
    return { staffId: res.staffId, managePath: managePath(res.appointmentId) };
  });
}
