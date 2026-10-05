import type { Metadata } from "next";
import { requirePagePermission } from "@/server/context";
import { listCategoryNames, listServices } from "@/server/services/catalog";
import { listStaff } from "@/server/services/staff";
import { ServicesBoard } from "./services-board";

export const metadata: Metadata = { title: "Usluge" };

export default async function ServicesPage() {
  const { salon } = await requirePagePermission("manageCatalog");
  const [services, staff, categories] = await Promise.all([
    listServices(salon.id, { includeInactive: true }),
    listStaff(salon.id),
    listCategoryNames(salon.id),
  ]);

  return (
    <ServicesBoard
      currency={salon.currency}
      categories={categories}
      staff={staff.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        categoryName: s.categoryName,
        durationMin: s.durationMin,
        bufferMin: s.bufferMin,
        gapStartMin: s.gapStartMin,
        gapMin: s.gapMin,
        color: s.color,
        priceCents: s.priceCents,
        priceFrom: s.priceFrom,
        bookableOnline: s.bookableOnline,
        active: s.active,
        staffIds: s.staffIds,
      }))}
    />
  );
}
