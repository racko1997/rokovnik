"use server";

import { cookies } from "next/headers";
import { runAction } from "@/server/action";
import { ACTIVE_SALON_COOKIE, requireUser } from "@/server/context";
import { createSalon } from "@/server/services/salons";

export async function createSalonAction(input: { name: string; city?: string; phone?: string }) {
  return runAction(async () => {
    const user = await requireUser();
    const salon = await createSalon(user.id, input);
    (await cookies()).set(ACTIVE_SALON_COOKIE, salon.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return { slug: salon.slug };
  });
}
