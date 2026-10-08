"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/action";
import { isLocalDate } from "@/server/domain/time";
import { DomainError } from "@/server/errors";
import { verifyManageToken } from "@/server/manage-link";
import { cancelManaged, notifyBookingLater, rescheduleManaged } from "@/server/services/booking";

function appointmentIdFrom(token: string) {
  const id = verifyManageToken(token);
  if (!id) throw new DomainError("NOT_FOUND", "Link nije ispravan.");
  return id;
}

export async function cancelByLinkAction(token: string) {
  return runAction(async () => {
    const id = appointmentIdFrom(token);
    await cancelManaged(id);
    notifyBookingLater(id, "cancelled");
    revalidatePath(`/termin/${token}`);
    revalidatePath("/app/kalendar");
  });
}

const rescheduleInput = z.object({ date: z.string().refine(isLocalDate), startMin: z.number().int().min(0).max(1439) });

export async function rescheduleByLinkAction(token: string, raw: z.input<typeof rescheduleInput>) {
  return runAction(async () => {
    const id = appointmentIdFrom(token);
    const input = rescheduleInput.parse(raw);
    const res = await rescheduleManaged(id, input);
    notifyBookingLater(id, "rescheduled", { previousStart: res.appt.startsAt });
    revalidatePath(`/termin/${token}`);
    revalidatePath("/app/kalendar");
  });
}
