"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { requirePermission } from "@/server/context";
import { listScheduleConflicts } from "@/server/services/booking";
import { updateSalonSettings, type salonSettingsInput } from "@/server/services/salons";
import { addClosure, removeClosure } from "@/server/services/schedule";

export async function updateSettingsAction(input: z.input<typeof salonSettingsInput>) {
  return runAction(async () => {
    const { salon } = await requirePermission("manageSettings");
    await updateSalonSettings(salon.id, input);
    revalidatePath("/", "layout");
  });
}

export async function addClosureAction(input: { startDate: string; endDate: string; reason?: string }) {
  return runAction(async () => {
    const { salon } = await requirePermission("manageSettings");
    const added = await addClosure(salon.id, input);
    revalidatePath("/app", "layout");
    // Koliko postojećih termina pada u te dane — treba ih riješiti
    const days = Math.round((Date.parse(added.endDate) - Date.parse(added.startDate)) / 86_400_000) + 1;
    const conflicts = await listScheduleConflicts(salon, { from: added.startDate, days: Math.min(days, 120) });
    return { conflicts: conflicts.length };
  });
}

export async function removeClosureAction(id: string) {
  return runAction(async () => {
    const { salon } = await requirePermission("manageSettings");
    await removeClosure(salon.id, id);
    revalidatePath("/app", "layout");
  });
}
