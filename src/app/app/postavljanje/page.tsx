import type { Metadata } from "next";
import { appUrl } from "@/lib/app-url";
import { requirePagePermission, requireUser } from "@/server/context";
import { listServices } from "@/server/services/catalog";
import { listStaff } from "@/server/services/staff";
import { SetupWizard } from "./setup-wizard";

export const metadata: Metadata = { title: "Postavljanje salona" };

export default async function SetupPage() {
  const ctx = await requirePagePermission("manageStaff");
  const user = await requireUser();
  const [services, staff] = await Promise.all([listServices(ctx.salon.id), listStaff(ctx.salon.id)]);
  return (
    <SetupWizard
      salonName={ctx.salon.name}
      bookingUrl={`${appUrl()}/s/${ctx.salon.slug}`}
      ownerName={user.name.split(" ")[0]}
      existing={{ services: services.length, staff: staff.length }}
    />
  );
}
