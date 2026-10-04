"use server";

import { cookies } from "next/headers";
import { runAction } from "@/server/action";
import { ACTIVE_SALON_COOKIE, isMember, requireUser } from "@/server/context";
import { DomainError } from "@/server/errors";

export async function switchSalonAction(salonId: string) {
  return runAction(async () => {
    const user = await requireUser();
    if (!(await isMember(user.id, salonId))) throw new DomainError("FORBIDDEN", "Nemate pristup ovom salonu.");
    (await cookies()).set(ACTIVE_SALON_COOKIE, salonId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  });
}
