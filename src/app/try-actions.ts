"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { runAction } from "@/server/action";
import { auth } from "@/server/auth";
import { ACTIVE_SALON_COOKIE } from "@/server/context";
import { DomainError } from "@/server/errors";
import { rateLimit } from "@/server/rate-limit";
import { createSandboxSalon, prepareSandbox } from "@/server/services/demo";

/**
 * "Isprobaj bez registracije": privremeni nalog i vlastita kopija demo salona
 * (kalendar, klijenti, analitika). Briše se nakon 24 sata.
 */
export async function startSandboxAction() {
  const res = await runAction(async () => {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!rateLimit(`sandbox:${ip}`, 5, 60 * 60_000)) {
      throw new DomainError("INVALID_INPUT", "Već ste otvorili nekoliko probnih salona. Pokušajte kasnije ili otvorite svoj salon.");
    }
    const { tag, email, password } = await prepareSandbox();
    // Better Auth pravi nalog i prijavljuje (kolačić sesije postavlja nextCookies)
    const { user } = await auth.api.signUpEmail({ body: { name: "Probni korisnik", email, password }, headers: await headers() });
    const salon = await createSandboxSalon(user.id, tag);
    (await cookies()).set(ACTIVE_SALON_COOKIE, salon.id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  });
  if (!res.ok) return res;
  redirect("/app/kalendar");
}
