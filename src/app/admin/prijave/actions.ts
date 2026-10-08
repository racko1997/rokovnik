"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action";
import { requirePlatformAdmin } from "@/server/admin";
import { DEMO_SLUG, resetDemoSalon } from "@/server/services/demo";
import { LEAD_STATUSES, setLeadStatus } from "@/server/services/leads";

export async function setLeadStatusAction(id: string, status: (typeof LEAD_STATUSES)[number]) {
  return runAction(async () => {
    await requirePlatformAdmin();
    await setLeadStatus(id, status);
    revalidatePath("/admin/prijave");
  });
}

/** Demo salon iza "Probaj kao klijent": obnavlja radnike, usluge i termine za ovu sedmicu. */
export async function resetDemoSalonAction() {
  return runAction(async () => {
    await requirePlatformAdmin();
    await resetDemoSalon();
    revalidatePath(`/s/${DEMO_SLUG}`);
  });
}
