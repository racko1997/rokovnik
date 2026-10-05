"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { can } from "@/lib/permissions";
import { runAction } from "@/server/action";
import { requirePermission } from "@/server/context";
import { getClientHistory, saveClient, type updateClientInput } from "@/server/services/clients";

export async function saveClientAction(id: string | null, input: z.input<typeof updateClientInput>) {
  return runAction(async () => {
    const { salon } = await requirePermission("manageBookings");
    const clientId = await saveClient(salon.id, id, input);
    revalidatePath("/app/klijenti");
    return clientId;
  });
}

/** Historija posjeta za panel klijenta (cijene samo za vlasnika i menadžera). */
export async function clientHistoryAction(clientId: string) {
  return runAction(async () => {
    const { salon, role } = await requirePermission("manageBookings");
    const showPrices = can(role, "viewRevenue");
    const visits = await getClientHistory(salon.id, clientId);
    return visits.map((v) => ({
      ...v,
      startsAt: v.startsAt.toISOString(),
      priceCents: showPrices ? v.priceCents : null,
    }));
  });
}

