import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { db } from "./db/client";
import { salonMembers, salons } from "./db/schema";
import { DomainError } from "./errors";

export const ACTIVE_SALON_COOKIE = "active_salon";

export type MemberRole = "owner" | "manager" | "staff";

/**
 * Kontekst salona za sve operacije u dashboardu.
 * Servisi primaju samo `salonId`, pa ih isto tako mogu zvati webhookovi
 * kanala i AI agent — bez zavisnosti od HTTP sesije.
 */
export interface SalonContext {
  userId: string;
  role: MemberRole;
  salon: typeof salons.$inferSelect;
}

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/prijava");
  return session.user;
}

export const getMemberships = cache(async (userId: string) => {
  return db
    .select({ salon: salons, role: salonMembers.role })
    .from(salonMembers)
    .innerJoin(salons, eq(salons.id, salonMembers.salonId))
    .where(eq(salonMembers.userId, userId))
    .orderBy(asc(salonMembers.createdAt));
});

/** Aktivni salon korisnika; bez salona šalje na kreiranje salona. */
export const requireSalon = cache(async (): Promise<SalonContext> => {
  const user = await requireUser();
  const memberships = await getMemberships(user.id);
  if (memberships.length === 0) redirect("/novi-salon");

  const preferred = (await cookies()).get(ACTIVE_SALON_COOKIE)?.value;
  const active = memberships.find((m) => m.salon.id === preferred) ?? memberships[0];
  return { userId: user.id, role: active.role, salon: active.salon };
});

/** Za akcije koje mijenjaju postavke salona (radnici, usluge, cjenovnik). */
export async function requireManager(): Promise<SalonContext> {
  const ctx = await requireSalon();
  if (ctx.role === "staff") {
    throw new DomainError("FORBIDDEN", "Samo vlasnik ili menadžer može mijenjati ove postavke.");
  }
  return ctx;
}

export async function isMember(userId: string, salonId: string) {
  const row = await db.query.salonMembers.findFirst({
    where: and(eq(salonMembers.userId, userId), eq(salonMembers.salonId, salonId)),
  });
  return Boolean(row);
}
