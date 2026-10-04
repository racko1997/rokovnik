"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { requireManager, requireSalon } from "@/server/context";
import type { LocalDate } from "@/server/domain/time";
import { listScheduleConflicts, moveAppointment, setAppointmentStatus } from "@/server/services/booking";
import { clearDayOverride, setDayOverride, type dayOverrideInput } from "@/server/services/schedule";
import { withSuggestions } from "./suggestions";

/** Sprema izmjenu za dan i vraća termine koje je ta izmjena pogodila. */
export async function saveDayOverrideAction(input: z.input<typeof dayOverrideInput>) {
  return runAction(async () => {
    const { salon } = await requireManager();
    await setDayOverride(salon.id, input);
    revalidatePath("/app", "layout");
    const conflicts = await listScheduleConflicts(salon, { from: input.date, days: 1, staffId: input.staffId });
    return withSuggestions(salon, conflicts);
  });
}

export async function clearDayOverrideAction(staffId: string, date: LocalDate) {
  return runAction(async () => {
    const { salon } = await requireManager();
    await clearDayOverride(salon.id, staffId, date);
    revalidatePath("/app", "layout");
    const conflicts = await listScheduleConflicts(salon, { from: date, days: 1, staffId });
    return withSuggestions(salon, conflicts);
  });
}

export async function reassignAction(appointmentId: string, fromStaffId: string, toStaffId: string) {
  return runAction(async () => {
    const { salon } = await requireSalon();
    await moveAppointment(salon, { appointmentId, fromStaffId, toStaffId });
    revalidatePath("/app", "layout");
  });
}

export async function cancelConflictAction(appointmentId: string) {
  return runAction(async () => {
    const { salon } = await requireSalon();
    await setAppointmentStatus(salon.id, appointmentId, "cancelled", { reason: "Promjena rasporeda" });
    revalidatePath("/app", "layout");
  });
}
