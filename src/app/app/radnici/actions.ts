"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/action";
import { requirePermission } from "@/server/context";
import { addDays, isLocalDate, zonedToUtc } from "@/server/domain/time";
import { addTimeOff, removeTimeOff, saveStaff, setStaffActive, type staffInput } from "@/server/services/staff";

export async function saveStaffAction(id: string | null, input: z.input<typeof staffInput>) {
  return runAction(async () => {
    const { salon } = await requirePermission("manageStaff");
    const staffId = await saveStaff(salon.id, id, input);
    revalidatePath("/app", "layout");
    return staffId;
  });
}

export async function setStaffActiveAction(id: string, active: boolean) {
  return runAction(async () => {
    const { salon } = await requirePermission("manageStaff");
    await setStaffActive(salon.id, id, active);
    revalidatePath("/app", "layout");
  });
}

const timeOffForm = z.object({
  staffId: z.uuid(),
  fromDate: z.string().refine(isLocalDate),
  toDate: z.string().refine(isLocalDate),
  /** null = cijeli dan */
  startMin: z.number().int().min(0).max(1440).nullable(),
  endMin: z.number().int().min(0).max(1440).nullable(),
  reason: z.string().optional(),
});

/** Datumi i sati su u lokalnom vremenu salona — pretvaramo ih ovdje. */
export async function addTimeOffAction(raw: z.input<typeof timeOffForm>) {
  return runAction(async () => {
    const { salon } = await requirePermission("manageShifts");
    const input = timeOffForm.parse(raw);
    const allDay = input.startMin === null || input.endMin === null;
    await addTimeOff(salon.id, {
      staffId: input.staffId,
      startsAt: zonedToUtc(input.fromDate, allDay ? 0 : input.startMin!, salon.timezone),
      endsAt: allDay
        ? zonedToUtc(addDays(input.toDate, 1), 0, salon.timezone)
        : zonedToUtc(input.toDate, input.endMin!, salon.timezone),
      reason: input.reason,
    });
    revalidatePath("/app", "layout");
  });
}

export async function removeTimeOffAction(id: string) {
  return runAction(async () => {
    const { salon } = await requirePermission("manageShifts");
    await removeTimeOff(salon.id, id);
    revalidatePath("/app", "layout");
  });
}
