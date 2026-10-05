import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { can, type Permission, type Role } from "@/lib/permissions";
import { auth } from "./auth";
import { db } from "./db/client";
import { salonMembers, salons } from "./db/schema";
import { DomainError } from "./errors";

export const ACTIVE_SALON_COOKIE = "active_salon";

export type MemberRole = Role;

/**
 * Kontekst salona za sve operacije u dashboardu.
 * Servisi primaju samo `salonId`, pa ih isto tako mogu zvati webhookovi
 * kanala i AI agent — bez zavisnosti od HTTP sesije.
 */
export interface SalonContext {
  userId: string;
  role: MemberRole;
  /** Radnik u kalendaru s kojim je korisnik povezan (ako je i sam radnik) */
  staffId: string | null;
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
    .select({ salon: salons, role: salonMembers.role, staffId: salonMembers.staffId })
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

  return activeContext(user.id, memberships);
});

/** Salon iz kolačića (ako je korisnik i dalje član), inače prvi salon korisnika. */
async function activeContext(userId: string, memberships: Awaited<ReturnType<typeof getMemberships>>): Promise<SalonContext> {
  const preferred = (await cookies()).get(ACTIVE_SALON_COOKIE)?.value;
  const active = memberships.find((m) => m.salon.id === preferred) ?? memberships[0];
  return { userId, role: active.role, staffId: active.staffId, salon: active.salon };
}

/** Za API rute: kontekst ili null (ruta vraća 401 umjesto preusmjeravanja na prijavu). */
export async function getSalonContext(): Promise<SalonContext | null> {
  const session = await getSession();
  if (!session) return null;
  const memberships = await getMemberships(session.user.id);
  if (!memberships.length) return null;
  return activeContext(session.user.id, memberships);
}

/**
 * Za server akcije: baca grešku ako uloga nema pravo.
 * Interfejs sakriva te opcije, ali provjera na serveru je ono što stvarno štiti.
 */
export async function requirePermission(permission: Permission): Promise<SalonContext> {
  const ctx = await requireSalon();
  if (!can(ctx.role, permission)) {
    throw new DomainError("FORBIDDEN", "Za ovo je potrebna uloga vlasnika ili menadžera.");
  }
  return ctx;
}

/** Za stranice: bez prava vraća na kalendar umjesto greške. */
export async function requirePagePermission(permission: Permission): Promise<SalonContext> {
  const ctx = await requireSalon();
  if (!can(ctx.role, permission)) redirect("/app/kalendar");
  return ctx;
}

export async function isMember(userId: string, salonId: string) {
  const row = await db.query.salonMembers.findFirst({
    where: and(eq(salonMembers.userId, userId), eq(salonMembers.salonId, salonId)),
  });
  return Boolean(row);
}
