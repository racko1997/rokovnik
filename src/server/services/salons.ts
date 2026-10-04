import { eq, like } from "drizzle-orm";
import { z } from "zod";
import { slugify } from "@/lib/slug";
import { db } from "../db/client";
import { salonMembers, salons } from "../db/schema";
import { DomainError } from "../errors";

export type Salon = typeof salons.$inferSelect;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const createSalonInput = z.object({
  name: z.string().trim().min(2, "Unesite naziv salona.").max(80),
  city: optionalText(60),
  phone: optionalText(30),
});

export async function createSalon(userId: string, raw: z.input<typeof createSalonInput>): Promise<Salon> {
  const input = createSalonInput.parse(raw);
  const slug = await uniqueSlug(slugify(input.name) || "salon");

  return db.transaction(async (tx) => {
    const [salon] = await tx
      .insert(salons)
      .values({ name: input.name, city: input.city, phone: input.phone, slug })
      .returning();
    await tx.insert(salonMembers).values({ salonId: salon.id, userId, role: "owner" });
    return salon;
  });
}

async function uniqueSlug(base: string): Promise<string> {
  const taken = new Set(
    (await db.select({ slug: salons.slug }).from(salons).where(like(salons.slug, `${base}%`))).map((r) => r.slug),
  );
  if (!taken.has(base) && !RESERVED_SLUGS.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

const RESERVED_SLUGS = new Set(["api", "app", "admin", "prijava", "registracija", "novi-salon"]);

export async function getSalonBySlug(slug: string): Promise<Salon | undefined> {
  return db.query.salons.findFirst({ where: eq(salons.slug, slug) });
}

export const salonSettingsInput = z.object({
  name: z.string().trim().min(2, "Unesite naziv salona.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Adresa smije imati samo mala slova, brojeve i crtice.")
    .min(3, "Adresa mora imati bar 3 znaka.")
    .max(48)
    .refine((s) => !RESERVED_SLUGS.has(s), "Ova adresa je rezervisana."),
  city: optionalText(60),
  address: optionalText(120),
  phone: optionalText(30),
  email: optionalText(120),
  about: optionalText(600),
  slotIntervalMin: z.coerce.number().int().refine((n) => [5, 10, 15, 20, 30, 60].includes(n)),
  minLeadMin: z.coerce.number().int().min(0).max(7 * 24 * 60),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
});

export async function updateSalonSettings(salonId: string, raw: z.input<typeof salonSettingsInput>) {
  const input = salonSettingsInput.parse(raw);
  const existing = await getSalonBySlug(input.slug);
  if (existing && existing.id !== salonId) {
    throw new DomainError("SLUG_TAKEN", "Ova adresa je zauzeta. Probajte drugu.");
  }
  await db.update(salons).set(input).where(eq(salons.id, salonId));
}
