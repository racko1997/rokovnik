"use server";

import { cookies } from "next/headers";
import { runAction } from "@/server/action";
import { ACTIVE_SALON_COOKIE, requireUser } from "@/server/context";
import { acceptInvite } from "@/server/services/team";

export async function acceptInviteAction(token: string) {
  return runAction(async () => {
    const user = await requireUser();
    const salonId = await acceptInvite(token, user.id);
    (await cookies()).set(ACTIVE_SALON_COOKIE, salonId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  });
}
