"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/action";
import { requireSalon } from "@/server/context";
import { isLocalDate, zonedToUtc } from "@/server/domain/time";
import { createAppointment, moveAppointment, setAppointmentStatus, type Status } from "@/server/services/booking";

const newAppointmentForm = z.object({
  serviceIds: z.array(z.uuid()),
  staffId: z.uuid(),
  date: z.string(),
  startMin: z.number().int().min(0).max(1439),
  clientId: z.uuid().optional(),
  client: z.object({ name: z.string(), phone: z.string().optional() }).optional(),
  notes: z.string().optional(),
});

export async function createAppointmentAction(raw: z.input<typeof newAppointmentForm>) {
  return runAction(async () => {
    const { salon, userId } = await requireSalon();
    const input = newAppointmentForm.parse(raw);
    const res = await createAppointment(
      salon,
      {
        serviceIds: input.serviceIds,
        staffId: input.staffId,
        startsAt: zonedToUtc(input.date, input.startMin, salon.timezone),
        clientId: input.clientId,
        client: input.clientId ? undefined : input.client,
        notes: input.notes,
        source: "dashboard",
      },
      { mode: "staff", userId },
    );
    revalidatePath("/app/kalendar");
    return { appointmentId: res.appointmentId };
  });
}

export async function setAppointmentStatusAction(appointmentId: string, status: Status) {
  return runAction(async () => {
    const { salon } = await requireSalon();
    await setAppointmentStatus(salon.id, appointmentId, status);
    revalidatePath("/app/kalendar");
  });
}

const moveForm = z.object({
  appointmentId: z.uuid(),
  fromStaffId: z.uuid(),
  toStaffId: z.uuid(),
  date: z.string().refine(isLocalDate),
  startMin: z.number().int().min(0).max(1439),
});

/** Prevlačenje termina u kalendaru: drugi radnik, drugo vrijeme ili drugi dan. */
export async function moveAppointmentAction(raw: z.input<typeof moveForm>) {
  return runAction(async () => {
    const { salon } = await requireSalon();
    const input = moveForm.parse(raw);
    await moveAppointment(salon, {
      appointmentId: input.appointmentId,
      fromStaffId: input.fromStaffId,
      toStaffId: input.toStaffId,
      startsAt: zonedToUtc(input.date, input.startMin, salon.timezone),
    });
    revalidatePath("/app", "layout");
  });
}
