// Radnici, njihovo radno vrijeme, usluge i odsustva.
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { SWATCHES } from "@/lib/swatches";
import { db } from "../db/client";
import { services, staff, staffServices, timeOff, workingHours } from "../db/schema";
import { isLocalDate } from "../domain/time";
import { DomainError } from "../errors";
import { mondayOf } from "./schedule";

export type Staff = typeof staff.$inferSelect;
/** week: 0 = sedmica A (ili jedina), 1 = sedmica B */
export type Shift = { weekday: number; week: number; startMin: number; endMin: number };
export type StaffWithDetails = Staff & { serviceIds: string[]; hours: Shift[] };

const swatchKeys = SWATCHES.map((s) => s.key) as [string, ...string[]];

const shiftInput = z
  .object({
    weekday: z.number().int().min(1).max(7),
    week: z.number().int().min(0).max(1).default(0),
    startMin: z.number().int().min(0).max(1440),
    endMin: z.number().int().min(0).max(1440),
  })
  .refine((s) => s.startMin < s.endMin, "Početak smjene mora biti prije kraja.");

export const staffInput = z
  .object({
    name: z.string().trim().min(2, "Unesite ime radnika.").max(60),
    title: z
      .string()
      .trim()
      .max(60)
      .optional()
      .transform((v) => v || null),
    color: z.enum(swatchKeys),
    phone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .transform((v) => v || null),
    bookableOnline: z.boolean().default(true),
    serviceIds: z.array(z.uuid()).default([]),
    hours: z.array(shiftInput).default([]),
    /** 1 = svake sedmice isto, 2 = sedmica A / sedmica B */
    rotationWeeks: z.union([z.literal(1), z.literal(2)]).default(1),
    /** Bilo koji dan sedmice A; spremamo njen ponedjeljak */
    rotationAnchor: z
      .string()
      .refine(isLocalDate, "Neispravan datum.")
      .nullish()
      .transform((v) => (v ? mondayOf(v) : null)),
  })
  .superRefine((v, ctx) => {
    if (v.rotationWeeks === 2 && !v.rotationAnchor) {
      ctx.addIssue({ code: "custom", message: "Odaberite od koje sedmice počinje sedmica A.", path: ["rotationAnchor"] });
    }
    for (const week of [0, 1]) {
      for (let day = 1; day <= 7; day++) {
        const shifts = v.hours.filter((h) => h.weekday === day && h.week === week).sort((a, b) => a.startMin - b.startMin);
        for (let i = 1; i < shifts.length; i++) {
          if (shifts[i].startMin < shifts[i - 1].endMin) {
            ctx.addIssue({ code: "custom", message: "Smjene istog dana se preklapaju.", path: ["hours"] });
            return;
          }
        }
      }
    }
  });

export async function listStaff(
  salonId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<StaffWithDetails[]> {
  const conds = [eq(staff.salonId, salonId)];
  if (!opts.includeInactive) conds.push(eq(staff.active, true));
  const rows = await db
    .select()
    .from(staff)
    .where(and(...conds))
    .orderBy(asc(staff.sortOrder), asc(staff.createdAt));
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const [links, hours] = await Promise.all([
    db.select().from(staffServices).where(inArray(staffServices.staffId, ids)),
    db
      .select()
      .from(workingHours)
      .where(inArray(workingHours.staffId, ids))
      .orderBy(asc(workingHours.weekday), asc(workingHours.startMin)),
  ]);

  return rows.map((r) => ({
    ...r,
    serviceIds: links.filter((l) => l.staffId === r.id).map((l) => l.serviceId),
    hours: hours
      .filter((h) => h.staffId === r.id)
      .map(({ weekday, week, startMin, endMin }) => ({ weekday, week, startMin, endMin })),
  }));
}

export async function saveStaff(salonId: string, id: string | null, raw: z.input<typeof staffInput>) {
  const input = staffInput.parse(raw);

  return db.transaction(async (tx) => {
    const values = {
      name: input.name,
      title: input.title,
      color: input.color,
      phone: input.phone,
      bookableOnline: input.bookableOnline,
      rotationWeeks: input.rotationWeeks,
      rotationAnchor: input.rotationWeeks === 2 ? input.rotationAnchor : null,
    };

    let staffId = id;
    if (staffId) {
      const updated = await tx
        .update(staff)
        .set(values)
        .where(and(eq(staff.id, staffId), eq(staff.salonId, salonId)))
        .returning({ id: staff.id });
      if (!updated.length) throw new DomainError("NOT_FOUND", "Radnik ne postoji.");
    } else {
      const count = await tx.$count(staff, eq(staff.salonId, salonId));
      const [created] = await tx
        .insert(staff)
        .values({ ...values, salonId, sortOrder: count })
        .returning({ id: staff.id });
      staffId = created.id;
    }

    if (input.serviceIds.length) {
      const owned = await tx
        .select({ id: services.id })
        .from(services)
        .where(and(eq(services.salonId, salonId), inArray(services.id, input.serviceIds)));
      if (owned.length !== new Set(input.serviceIds).size) {
        throw new DomainError("INVALID_INPUT", "Nepoznata usluga.");
      }
    }

    await tx.delete(staffServices).where(eq(staffServices.staffId, staffId));
    if (input.serviceIds.length) {
      await tx.insert(staffServices).values(input.serviceIds.map((serviceId) => ({ staffId: staffId!, serviceId })));
    }

    await tx.delete(workingHours).where(eq(workingHours.staffId, staffId));
    // Bez rotacije čuvamo samo sedmicu A
    const hours = input.rotationWeeks === 2 ? input.hours : input.hours.filter((h) => h.week === 0);
    if (hours.length) {
      await tx.insert(workingHours).values(hours.map((h) => ({ ...h, staffId: staffId!, salonId })));
    }
    return staffId;
  });
}

export async function setStaffActive(salonId: string, id: string, active: boolean) {
  await db
    .update(staff)
    .set({ active })
    .where(and(eq(staff.id, id), eq(staff.salonId, salonId)));
}

export const timeOffInput = z
  .object({
    staffId: z.uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => v || null),
  })
  .refine((v) => v.startsAt < v.endsAt, "Kraj odsustva mora biti poslije početka.");

export async function addTimeOff(salonId: string, raw: z.input<typeof timeOffInput>) {
  const input = timeOffInput.parse(raw);
  const owner = await db.query.staff.findFirst({ where: and(eq(staff.id, input.staffId), eq(staff.salonId, salonId)) });
  if (!owner) throw new DomainError("NOT_FOUND", "Radnik ne postoji.");
  await db.insert(timeOff).values({ ...input, salonId });
}

export async function removeTimeOff(salonId: string, id: string) {
  await db.delete(timeOff).where(and(eq(timeOff.id, id), eq(timeOff.salonId, salonId)));
}

export async function listTimeOff(salonId: string, from: Date, to: Date) {
  return db
    .select()
    .from(timeOff)
    .where(and(eq(timeOff.salonId, salonId), lt(timeOff.startsAt, to), gt(timeOff.endsAt, from)))
    .orderBy(asc(timeOff.startsAt));
}
