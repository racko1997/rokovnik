import type { Metadata } from "next";
import { requireSalon } from "@/server/context";
import { addDays, toLocalDate, toLocalMinutes } from "@/server/domain/time";
import { listServices } from "@/server/services/catalog";
import { listStaff, listTimeOff } from "@/server/services/staff";
import { StaffBoard } from "./staff-board";

export const metadata: Metadata = { title: "Radnici" };

export default async function StaffPage() {
  const { salon } = await requireSalon();
  const now = new Date();
  const [staff, services, absences] = await Promise.all([
    listStaff(salon.id, { includeInactive: true }),
    listServices(salon.id),
    listTimeOff(salon.id, now, new Date(now.getTime() + 365 * 86_400_000)),
  ]);

  const tz = salon.timezone;
  return (
    <StaffBoard
      staff={staff.map((s) => ({
        id: s.id,
        name: s.name,
        title: s.title,
        color: s.color,
        phone: s.phone,
        bookableOnline: s.bookableOnline,
        active: s.active,
        serviceIds: s.serviceIds,
        hours: s.hours,
        rotationWeeks: s.rotationWeeks,
        rotationAnchor: s.rotationAnchor,
      }))}
      services={services.map((s) => ({ id: s.id, name: s.name, categoryName: s.categoryName }))}
      timeOff={absences.map((t) => {
        // Kraj u ponoć znači "do kraja prethodnog dana"
        const endMin = toLocalMinutes(t.endsAt, tz);
        const endDate = toLocalDate(t.endsAt, tz);
        return {
          id: t.id,
          staffId: t.staffId,
          fromDate: toLocalDate(t.startsAt, tz),
          toDate: endMin === 0 ? addDays(endDate, -1) : endDate,
          startMin: toLocalMinutes(t.startsAt, tz),
          endMin,
          reason: t.reason,
        };
      })}
    />
  );
}
