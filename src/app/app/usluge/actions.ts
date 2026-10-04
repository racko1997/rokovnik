"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action";
import { requireManager } from "@/server/context";
import { saveService, setServiceActive, type serviceInput } from "@/server/services/catalog";
import type { z } from "zod";

export async function saveServiceAction(id: string | null, input: z.input<typeof serviceInput>) {
  return runAction(async () => {
    const { salon } = await requireManager();
    const serviceId = await saveService(salon.id, id, input);
    revalidatePath("/app", "layout");
    return serviceId;
  });
}

export async function setServiceActiveAction(id: string, active: boolean) {
  return runAction(async () => {
    const { salon } = await requireManager();
    await setServiceActive(salon.id, id, active);
    revalidatePath("/app", "layout");
  });
}
