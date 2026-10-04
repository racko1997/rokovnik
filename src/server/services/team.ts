// Tim salona: ko ima pristup aplikaciji, s kojom ulogom, i pozivnice za nove članove.
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { assignableRoles, type Role } from "@/lib/permissions";
import { db } from "../db/client";
import { salonInvites, salonMembers, salons, staff, user } from "../db/schema";
import { DomainError } from "../errors";

const INVITE_DAYS = 7;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const inviteInput = z.object({
  email: z
    .union([z.email("Neispravan email."), z.literal("")])
    .nullish()
    .transform((v) => v || null),
  role: z.enum(["staff", "manager"]),
  staffId: z.uuid().nullish(),
});

/** Pravi pozivnicu i vraća token za link (token se nigdje ne čuva u izvornom obliku). */
export async function createInvite(
  salonId: string,
  by: { userId: string; role: Role },
  raw: z.input<typeof inviteInput>,
): Promise<{ token: string; expiresAt: Date }> {
  const input = inviteInput.parse(raw);
  if (!assignableRoles(by.role).includes(input.role)) {
    throw new DomainError("FORBIDDEN", "Nemate pravo pozvati korisnika s tom ulogom.");
  }
  if (input.staffId) {
    const member = await db.query.staff.findFirst({ where: and(eq(staff.id, input.staffId), eq(staff.salonId, salonId)) });
    if (!member) throw new DomainError("NOT_FOUND", "Radnik ne postoji.");
    const linked = await db.query.salonMembers.findFirst({
      where: and(eq(salonMembers.salonId, salonId), eq(salonMembers.staffId, input.staffId)),
    });
    if (linked) throw new DomainError("INVALID_INPUT", "Ovaj radnik već ima pristup aplikaciji.");
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  await db.insert(salonInvites).values({
    salonId,
    email: input.email,
    role: input.role,
    staffId: input.staffId ?? null,
    tokenHash: hashToken(token),
    expiresAt,
    createdByUserId: by.userId,
  });
  return { token, expiresAt };
}

export type InviteStatus = "valid" | "expired" | "used" | "missing";

export async function getInvite(token: string) {
  const [row] = await db
    .select({ invite: salonInvites, salonName: salons.name, staffName: staff.name })
    .from(salonInvites)
    .innerJoin(salons, eq(salons.id, salonInvites.salonId))
    .leftJoin(staff, eq(staff.id, salonInvites.staffId))
    .where(eq(salonInvites.tokenHash, hashToken(token)));
  if (!row) return { status: "missing" as InviteStatus, invite: null };
  const status: InviteStatus = row.invite.acceptedAt ? "used" : row.invite.expiresAt < new Date() ? "expired" : "valid";
  return { status, invite: row };
}

/** Korisnik prihvata pozivnicu i postaje član salona. Vraća ID salona. */
export async function acceptInvite(token: string, userId: string): Promise<string> {
  const { status, invite } = await getInvite(token);
  if (status === "missing") throw new DomainError("NOT_FOUND", "Pozivnica ne postoji.");
  if (status === "used") throw new DomainError("INVALID_INPUT", "Ova pozivnica je već iskorištena.");
  if (status === "expired") throw new DomainError("INVALID_INPUT", "Pozivnica je istekla. Zatražite novu od vlasnika salona.");
  const inv = invite!.invite;

  await db.transaction(async (tx) => {
    const existing = await tx.query.salonMembers.findFirst({
      where: and(eq(salonMembers.salonId, inv.salonId), eq(salonMembers.userId, userId)),
    });
    if (existing) {
      // Već je član: ne smanjujemo ulogu, samo dopunjavamo vezu s radnikom
      await tx
        .update(salonMembers)
        .set({
          role: existing.role === "staff" ? inv.role : existing.role,
          staffId: existing.staffId ?? inv.staffId,
        })
        .where(and(eq(salonMembers.salonId, inv.salonId), eq(salonMembers.userId, userId)));
    } else {
      await tx.insert(salonMembers).values({ salonId: inv.salonId, userId, role: inv.role, staffId: inv.staffId });
    }
    const claimed = await tx
      .update(salonInvites)
      .set({ acceptedAt: new Date(), acceptedByUserId: userId })
      .where(and(eq(salonInvites.id, inv.id), isNull(salonInvites.acceptedAt)))
      .returning({ id: salonInvites.id });
    if (!claimed.length) throw new DomainError("INVALID_INPUT", "Ova pozivnica je već iskorištena.");
  });
  return inv.salonId;
}

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: Role;
  staffId: string | null;
  joinedAt: Date;
}

export async function listTeam(salonId: string) {
  const [members, invites] = await Promise.all([
    db
      .select({
        userId: salonMembers.userId,
        name: user.name,
        email: user.email,
        role: salonMembers.role,
        staffId: salonMembers.staffId,
        joinedAt: salonMembers.createdAt,
      })
      .from(salonMembers)
      .innerJoin(user, eq(user.id, salonMembers.userId))
      .where(eq(salonMembers.salonId, salonId))
      .orderBy(asc(salonMembers.createdAt)),
    db
      .select({
        id: salonInvites.id,
        email: salonInvites.email,
        role: salonInvites.role,
        staffId: salonInvites.staffId,
        expiresAt: salonInvites.expiresAt,
        createdAt: salonInvites.createdAt,
      })
      .from(salonInvites)
      .where(and(eq(salonInvites.salonId, salonId), isNull(salonInvites.acceptedAt), gt(salonInvites.expiresAt, new Date())))
      .orderBy(asc(salonInvites.createdAt)),
  ]);
  return { members: members as TeamMember[], invites };
}

export async function revokeInvite(salonId: string, inviteId: string) {
  await db.delete(salonInvites).where(and(eq(salonInvites.id, inviteId), eq(salonInvites.salonId, salonId)));
}

async function loadMember(salonId: string, userId: string) {
  const m = await db.query.salonMembers.findFirst({ where: and(eq(salonMembers.salonId, salonId), eq(salonMembers.userId, userId)) });
  if (!m) throw new DomainError("NOT_FOUND", "Član ne postoji.");
  return m;
}

/** Mijenja ulogu ili vezu s radnikom. Vlasnika ne može niko mijenjati. */
export async function updateMember(
  salonId: string,
  by: { userId: string; role: Role },
  targetUserId: string,
  patch: { role?: Role; staffId?: string | null },
) {
  const target = await loadMember(salonId, targetUserId);
  // Svako smije povezati sebe sa svojom kolonom u kalendaru (npr. vlasnik koji i sam radi)
  const selfLinkOnly = by.userId === targetUserId && patch.role === undefined;
  if (!selfLinkOnly) {
    if (target.role === "owner") throw new DomainError("FORBIDDEN", "Ulogu vlasnika nije moguće mijenjati.");
    if (target.role === "manager" && by.role !== "owner") throw new DomainError("FORBIDDEN", "Samo vlasnik mijenja menadžere.");
  }
  if (patch.role && !assignableRoles(by.role).includes(patch.role)) {
    throw new DomainError("FORBIDDEN", "Nemate pravo dodijeliti tu ulogu.");
  }
  if (patch.staffId) {
    const member = await db.query.staff.findFirst({ where: and(eq(staff.id, patch.staffId), eq(staff.salonId, salonId)) });
    if (!member) throw new DomainError("NOT_FOUND", "Radnik ne postoji.");
    const taken = await db.query.salonMembers.findFirst({
      where: and(eq(salonMembers.salonId, salonId), eq(salonMembers.staffId, patch.staffId)),
    });
    if (taken && taken.userId !== targetUserId) throw new DomainError("INVALID_INPUT", "Ova kolona je već povezana s drugim nalogom.");
  }
  await db
    .update(salonMembers)
    .set({ ...(patch.role && { role: patch.role }), ...(patch.staffId !== undefined && { staffId: patch.staffId }) })
    .where(and(eq(salonMembers.salonId, salonId), eq(salonMembers.userId, targetUserId)));
}

/** Uklanja pristup salonu (nalog korisnika ostaje). */
export async function removeMember(salonId: string, by: { userId: string; role: Role }, targetUserId: string) {
  const target = await loadMember(salonId, targetUserId);
  if (target.role === "owner") throw new DomainError("FORBIDDEN", "Vlasnik se ne može ukloniti iz salona.");
  if (target.role === "manager" && by.role !== "owner") throw new DomainError("FORBIDDEN", "Samo vlasnik uklanja menadžere.");
  await db.delete(salonMembers).where(and(eq(salonMembers.salonId, salonId), eq(salonMembers.userId, targetUserId)));
}
