// Probni salon ("Isprobaj bez registracije"): nastaje s podacima, a nakon isteka se briše
// zajedno s probnim nalogom — pravi nalozi ostaju netaknuti.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { appointments, salonMembers, salons, user } from "../db/schema";
import { createSandboxSalon, deleteExpiredSandboxes, prepareSandbox } from "./demo";

const created: { salonId?: string; userIds: string[] } = { userIds: [] };

afterAll(async () => {
  if (created.salonId) await db.delete(salons).where(eq(salons.id, created.salonId));
  for (const id of created.userIds) await db.delete(user).where(eq(user.id, id));
});

describe("probni salon", () => {
  it("pravi salon s terminima, a po isteku briše salon i probni nalog", { timeout: 180_000 }, async () => {
    const { tag, email } = await prepareSandbox();
    expect(email.endsWith("@proba.rokovnik.test")).toBe(true);

    const id = crypto.randomUUID();
    await db.insert(user).values({ id, name: "Probni korisnik", email, emailVerified: true });
    created.userIds.push(id);
    // Pravi korisnik koji je (npr. kao gost) član istog salona ne smije biti obrisan
    const realId = crypto.randomUUID();
    await db.insert(user).values({ id: realId, name: "Pravi korisnik", email: `pravi-${tag}@primjer.ba`, emailVerified: true });
    created.userIds.push(realId);

    const salon = await createSandboxSalon(id, tag);
    created.salonId = salon.id;
    expect(salon.slug).toBe(`proba-${tag}`);
    expect(salon.sandboxExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    await db.insert(salonMembers).values({ salonId: salon.id, userId: realId, role: "staff" });

    const appts = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.salonId, salon.id));
    expect(appts.length).toBeGreaterThan(50);

    // Još nije istekao — ostaje
    await deleteExpiredSandboxes();
    expect(await db.query.salons.findFirst({ where: eq(salons.id, salon.id) })).toBeTruthy();

    // Istekao — briše se salon i probni nalog, pravi nalog ostaje
    await db.update(salons).set({ sandboxExpiresAt: new Date(Date.now() - 1000) }).where(eq(salons.id, salon.id));
    expect(await deleteExpiredSandboxes()).toBeGreaterThanOrEqual(1);
    expect(await db.query.salons.findFirst({ where: eq(salons.id, salon.id) })).toBeUndefined();
    expect(await db.query.user.findFirst({ where: eq(user.id, id) })).toBeUndefined();
    expect(await db.query.user.findFirst({ where: eq(user.id, realId) })).toBeTruthy();
    created.salonId = undefined;
  });
});
