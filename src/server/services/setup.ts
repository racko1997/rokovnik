// Brzo postavljanje novog salona: radnici, radno vrijeme i usluge iz šablona u jednom koraku.
// Sve ide u jednoj transakciji i skupnim upisima (nekoliko upita umjesto desetina),
// da prvi utisak bude brz i da nema "pola postavljenog" salona ako nešto pukne.
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { nextServiceColor } from "@/lib/service-colors";
import { nextFreeSwatch } from "@/lib/swatches";
import { db } from "../db/client";
import { salonMembers, serviceCategories, services, staff, staffServices, workingHours } from "../db/schema";
import { serviceInput } from "./catalog";

export const quickSetupInput = z.object({
  services: z
    .array(
      serviceInput.safeExtend({
        categoryName: z.string().trim().min(1).max(40),
      }),
    )
    .min(1, "Odaberite bar jednu uslugu.")
    .max(80),
  staff: z
    .array(z.object({ name: z.string().trim().min(2, "Unesite ime radnika.").max(60), isMe: z.boolean().default(false) }))
    .min(1, "Dodajte bar jednog radnika.")
    .max(30)
    .refine((list) => list.filter((s) => s.isMe).length <= 1, "Samo jedan radnik može biti „ja“."),
  /** Radno vrijeme salona — isto za sve radnike na početku, kasnije se mijenja po radniku */
  hours: z
    .array(
      z
        .object({ weekday: z.number().int().min(1).max(7), startMin: z.number().int().min(0).max(1440), endMin: z.number().int().min(0).max(1440) })
        .refine((h) => h.startMin < h.endMin, "Početak mora biti prije kraja."),
    )
    .min(1, "Unesite bar jedan radni dan."),
});

export async function applyQuickSetup(salonId: string, ownerUserId: string, raw: z.input<typeof quickSetupInput>) {
  const input = quickSetupInput.parse(raw);

  return db.transaction(async (tx) => {
    // Radnici (boje redom iz palete, nastavljajući na postojeće)
    const existingStaff = await tx.select({ color: staff.color }).from(staff).where(eq(staff.salonId, salonId));
    const used = existingStaff.map((s) => s.color);
    const createdStaff = await tx
      .insert(staff)
      .values(
        input.staff.map((s, i) => {
          const color = nextFreeSwatch(used);
          used.push(color);
          return { salonId, name: s.name, color, sortOrder: existingStaff.length + i };
        }),
      )
      .returning({ id: staff.id });
    const staffIds = createdStaff.map((s) => s.id);

    await tx.insert(workingHours).values(staffIds.flatMap((staffId) => input.hours.map((h) => ({ ...h, week: 0, salonId, staffId }))));

    // Kategorije: postojeće se ponovo koriste (bez obzira na velika/mala slova)
    const existingCats = await tx.select().from(serviceCategories).where(eq(serviceCategories.salonId, salonId));
    const catId = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]));
    const newCats = [...new Set(input.services.map((s) => s.categoryName))].filter((n) => !catId.has(n.toLowerCase()));
    if (newCats.length) {
      const created = await tx
        .insert(serviceCategories)
        .values(newCats.map((name, i) => ({ salonId, name, sortOrder: existingCats.length + i })))
        .returning();
      for (const c of created) catId.set(c.name.toLowerCase(), c.id);
    }

    // Svaka usluga svoja boja, nastavljajući na postojeće u salonu
    const usedColors = (await tx.select({ color: services.color }).from(services).where(eq(services.salonId, salonId))).map((r) => r.color);
    const colors = input.services.map((s) => {
      const color = s.color ?? nextServiceColor(usedColors);
      usedColors.push(color);
      return color;
    });
    const createdServices = await tx
      .insert(services)
      .values(
        input.services.map((s, i) => ({
          color: colors[i],
          salonId,
          categoryId: catId.get(s.categoryName.toLowerCase())!,
          name: s.name,
          description: s.description,
          durationMin: s.durationMin,
          bufferMin: s.bufferMin,
          gapStartMin: s.gapMin > 0 ? s.gapStartMin : 0,
          gapMin: s.gapMin,
          priceCents: Math.round(s.price * 100),
          priceFrom: s.priceFrom,
          bookableOnline: s.bookableOnline,
          sortOrder: i,
        })),
      )
      .returning({ id: services.id });

    // Na početku svaki radnik radi sve usluge; vlasnik to kasnije suzi po radniku
    await tx.insert(staffServices).values(createdServices.flatMap((svc) => staffIds.map((staffId) => ({ staffId, serviceId: svc.id }))));

    const meIndex = input.staff.findIndex((s) => s.isMe);
    if (meIndex >= 0) {
      await tx
        .update(salonMembers)
        .set({ staffId: staffIds[meIndex] })
        .where(and(eq(salonMembers.salonId, salonId), eq(salonMembers.userId, ownerUserId)));
    }
    return { staff: staffIds.length, services: createdServices.length };
  });
}
