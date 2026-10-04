"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { Role } from "@/lib/permissions";
import { runAction } from "@/server/action";
import { requirePermission } from "@/server/context";
import { createInvite, removeMember, revokeInvite, updateMember, type inviteInput } from "@/server/services/team";

export async function createInviteAction(input: z.input<typeof inviteInput>) {
  return runAction(async () => {
    const ctx = await requirePermission("manageTeam");
    const res = await createInvite(ctx.salon.id, ctx, input);
    revalidatePath("/app/radnici", "layout");
    return { token: res.token, expiresAt: res.expiresAt.toISOString() };
  });
}

export async function revokeInviteAction(id: string) {
  return runAction(async () => {
    const ctx = await requirePermission("manageTeam");
    await revokeInvite(ctx.salon.id, id);
    revalidatePath("/app/radnici", "layout");
  });
}

export async function updateMemberAction(userId: string, patch: { role?: Role; staffId?: string | null }) {
  return runAction(async () => {
    const ctx = await requirePermission("manageTeam");
    await updateMember(ctx.salon.id, ctx, userId, patch);
    revalidatePath("/app", "layout");
  });
}

export async function removeMemberAction(userId: string) {
  return runAction(async () => {
    const ctx = await requirePermission("manageTeam");
    await removeMember(ctx.salon.id, ctx, userId);
    revalidatePath("/app", "layout");
  });
}
