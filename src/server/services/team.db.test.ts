// Pozivnice i uloge: ko smije koga pozvati, mijenjati i ukloniti.
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { salonInvites, salonMembers, salons, user } from "../db/schema";
import { DomainError } from "../errors";
import type { Salon } from "./salons";
import { saveStaff } from "./staff";
import { acceptInvite, createInvite, getInvite, listTeam, removeMember, updateMember } from "./team";

let salon: Salon;
let lanaStaff: string;
const ids = { owner: crypto.randomUUID(), lana: crypto.randomUUID(), manager: crypto.randomUUID() };
const owner = { userId: ids.owner, role: "owner" as const };

async function expectError(p: Promise<unknown>, code: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

beforeAll(async () => {
  await db.insert(user).values(
    Object.entries(ids).map(([name, id]) => ({ id, name, email: `${name}-${id.slice(0, 6)}@test.rokovnik` })),
  );
  [salon] = await db.insert(salons).values({ name: "Tim test", slug: `tim-${crypto.randomUUID().slice(0, 8)}` }).returning();
  await db.insert(salonMembers).values({ salonId: salon.id, userId: ids.owner, role: "owner" });
  lanaStaff = await saveStaff(salon.id, null, { name: "Lana", color: "rubin" });
});

afterAll(async () => {
  if (salon) await db.delete(salons).where(eq(salons.id, salon.id));
  await db.delete(user).where(inArray(user.id, Object.values(ids)));
});

describe("pozivnice", () => {
  let token: string;

  it("vlasnik poziva radnika vezanog za kolonu u kalendaru", async () => {
    ({ token } = await createInvite(salon.id, owner, { role: "staff", staffId: lanaStaff, email: "lana@test.ba" }));
    const { status, invite } = await getInvite(token);
    expect(status).toBe("valid");
    expect(invite?.staffName).toBe("Lana");
  });

  it("u bazi se čuva samo hash tokena", async () => {
    const rows = await db.select().from(salonInvites).where(eq(salonInvites.salonId, salon.id));
    expect(rows[0].tokenHash).not.toContain(token);
  });

  it("radnik prihvata pozivnicu i dobija ulogu i svoju kolonu", async () => {
    expect(await acceptInvite(token, ids.lana)).toBe(salon.id);
    const m = await db.query.salonMembers.findFirst({
      where: and(eq(salonMembers.salonId, salon.id), eq(salonMembers.userId, ids.lana)),
    });
    expect(m).toMatchObject({ role: "staff", staffId: lanaStaff });
  });

  it("pozivnica se ne može iskoristiti dvaput", async () => {
    await expectError(acceptInvite(token, ids.manager), "INVALID_INPUT");
  });

  it("istekla pozivnica ne važi", async () => {
    const { token: old } = await createInvite(salon.id, owner, { role: "staff" });
    await db.update(salonInvites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(salonInvites.salonId, salon.id));
    expect((await getInvite(old)).status).toBe("expired");
    await expectError(acceptInvite(old, ids.manager), "INVALID_INPUT");
  });

  it("isti radnik ne može dobiti dva naloga", async () => {
    await expectError(createInvite(salon.id, owner, { role: "staff", staffId: lanaStaff }), "INVALID_INPUT");
  });
});

describe("uloge", () => {
  it("menadžer ne može pozvati menadžera, vlasnik može", async () => {
    await expectError(createInvite(salon.id, { userId: ids.lana, role: "manager" }, { role: "manager" }), "FORBIDDEN");
    const { token } = await createInvite(salon.id, owner, { role: "manager" });
    await acceptInvite(token, ids.manager);
    const team = await listTeam(salon.id);
    expect(team.members.map((m) => m.role).sort()).toEqual(["manager", "owner", "staff"]);
  });

  it("vlasnika niko ne može promijeniti ni ukloniti", async () => {
    const manager = { userId: ids.manager, role: "manager" as const };
    await expectError(updateMember(salon.id, manager, ids.owner, { role: "staff" }), "FORBIDDEN");
    await expectError(removeMember(salon.id, manager, ids.owner), "FORBIDDEN");
  });

  it("menadžer ne mijenja drugog menadžera, ali mijenja radnika", async () => {
    const manager = { userId: ids.manager, role: "manager" as const };
    await expectError(removeMember(salon.id, { userId: ids.lana, role: "manager" }, ids.manager), "FORBIDDEN");
    await updateMember(salon.id, manager, ids.lana, { staffId: null });
    await removeMember(salon.id, manager, ids.lana);
    const team = await listTeam(salon.id);
    expect(team.members.some((m) => m.userId === ids.lana)).toBe(false);
  });
});
