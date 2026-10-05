"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action";
import { requirePlatformAdmin } from "@/server/admin";
import { LEAD_STATUSES, setLeadStatus } from "@/server/services/leads";

export async function setLeadStatusAction(id: string, status: (typeof LEAD_STATUSES)[number]) {
  return runAction(async () => {
    await requirePlatformAdmin();
    await setLeadStatus(id, status);
    revalidatePath("/admin/prijave");
  });
}
