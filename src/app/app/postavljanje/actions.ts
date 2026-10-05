"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { runAction } from "@/server/action";
import { requirePermission } from "@/server/context";
import { applyQuickSetup, type quickSetupInput } from "@/server/services/setup";

export async function quickSetupAction(input: z.input<typeof quickSetupInput>) {
  return runAction(async () => {
    const ctx = await requirePermission("manageStaff");
    const res = await applyQuickSetup(ctx.salon.id, ctx.userId, input);
    revalidatePath("/app", "layout");
    return res;
  });
}
