// Usluge i kategorije (cjenovnik salona).
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "../db/client";
import { serviceCategories, services, staff, staffServices } from "../db/schema";
import { DomainError } from "../errors";

export type Service = typeof services.$inferSelect;
export type ServiceWithStaff = Service & { staffIds: string[]; categoryName: string | null };

export const serviceInput = z
  .object({
  name: z.string().trim().min(2, "Unesite naziv usluge.").max(80),
  description: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
  categoryName: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
  durationMin: z.coerce.number().int().min(5, "Najkraće trajanje je 5 min.").max(600),
  bufferMin: z.coerce.number().int().min(0).max(120).default(0),
  /** Vrijeme djelovanja: počinje nakon gapStartMin minuta i traje gapMin (0 = bez) */
  gapStartMin: z.coerce.number().int().min(0).max(600).default(0),
  gapMin: z.coerce.number().int().min(0).max(300).default(0),
  /** U KM, npr. 25 ili 25.5 */
  price: z.coerce.number().min(0, "Cijena ne može biti negativna.").max(100000),
  priceFrom: z.coerce.boolean().default(false),
  bookableOnline: z.coerce.boolean().default(true),
  staffIds: z.array(z.uuid()).default([]),
  })
  .refine((v) => v.gapMin === 0 || (v.gapStartMin > 0 && v.gapStartMin + v.gapMin < v.durationMin), {
    message: "Vrijeme djelovanja mora početi nakon početka i završiti prije kraja usluge.",
    path: ["gapMin"],
  });

export async function listServices(
  salonId: string,
  opts: { onlineOnly?: boolean; includeInactive?: boolean } = {},
): Promise<ServiceWithStaff[]> {
  const conds = [eq(services.salonId, salonId)];
  if (!opts.includeInactive) conds.push(eq(services.active, true));
  if (opts.onlineOnly) conds.push(eq(services.bookableOnline, true));

  const rows = await db
    .select({ service: services, categoryName: serviceCategories.name, categorySort: serviceCategories.sortOrder })
    .from(services)
    .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .where(and(...conds))
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name), asc(services.sortOrder), asc(services.name));

  const ids = rows.map((r) => r.service.id);
  const links = ids.length
    ? await db
        .select({ serviceId: staffServices.serviceId, staffId: staffServices.staffId })
        .from(staffServices)
        .innerJoin(staff, eq(staff.id, staffServices.staffId))
        .where(and(inArray(staffServices.serviceId, ids), eq(staff.active, true)))
    : [];

  return rows.map((r) => ({
    ...r.service,
    categoryName: r.categoryName,
    staffIds: links.filter((l) => l.serviceId === r.service.id).map((l) => l.staffId),
  }));
}

export async function listCategoryNames(salonId: string): Promise<string[]> {
  const rows = await db
    .select({ name: serviceCategories.name })
    .from(serviceCategories)
    .where(eq(serviceCategories.salonId, salonId))
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
  return rows.map((r) => r.name);
}

export async function saveService(salonId: string, id: string | null, raw: z.input<typeof serviceInput>) {
  const input = serviceInput.parse(raw);

  return db.transaction(async (tx) => {
    const categoryId = input.categoryName ? await ensureCategory(tx, salonId, input.categoryName) : null;
    const values = {
      name: input.name,
      description: input.description,
      categoryId,
      durationMin: input.durationMin,
      bufferMin: input.bufferMin,
      gapStartMin: input.gapMin > 0 ? input.gapStartMin : 0,
      gapMin: input.gapMin,
      priceCents: Math.round(input.price * 100),
      priceFrom: input.priceFrom,
      bookableOnline: input.bookableOnline,
    };

    let serviceId = id;
    if (serviceId) {
      const updated = await tx
        .update(services)
        .set(values)
        .where(and(eq(services.id, serviceId), eq(services.salonId, salonId)))
        .returning({ id: services.id });
      if (!updated.length) throw new DomainError("NOT_FOUND", "Usluga ne postoji.");
    } else {
      const [created] = await tx.insert(services).values({ ...values, salonId }).returning({ id: services.id });
      serviceId = created.id;
    }

    await assertStaffInSalon(tx, salonId, input.staffIds);
    await tx.delete(staffServices).where(eq(staffServices.serviceId, serviceId));
    if (input.staffIds.length) {
      await tx.insert(staffServices).values(input.staffIds.map((staffId) => ({ staffId, serviceId: serviceId! })));
    }
    return serviceId;
  });
}

/** Usluge se ne brišu (stari termini ih referenciraju) — samo se arhiviraju. */
export async function setServiceActive(salonId: string, id: string, active: boolean) {
  await db
    .update(services)
    .set({ active })
    .where(and(eq(services.id, id), eq(services.salonId, salonId)));
}

async function ensureCategory(tx: Tx, salonId: string, name: string): Promise<string> {
  const existing = await tx
    .select({ id: serviceCategories.id, name: serviceCategories.name })
    .from(serviceCategories)
    .where(eq(serviceCategories.salonId, salonId));
  const match = existing.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;
  const [created] = await tx
    .insert(serviceCategories)
    .values({ salonId, name, sortOrder: existing.length })
    .returning({ id: serviceCategories.id });
  return created.id;
}

async function assertStaffInSalon(tx: Tx, salonId: string, staffIds: string[]) {
  if (!staffIds.length) return;
  const found = await tx
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.salonId, salonId), inArray(staff.id, staffIds)));
  if (found.length !== new Set(staffIds).size) throw new DomainError("INVALID_INPUT", "Nepoznat radnik.");
}
