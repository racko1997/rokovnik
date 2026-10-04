import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { appUrl } from "@/lib/app-url";
import { requireSalon } from "@/server/context";
import { toLocalDate } from "@/server/domain/time";
import { listClosures } from "@/server/services/schedule";
import { Closures } from "./closures";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Postavke" };

export default async function SettingsPage() {
  const { salon } = await requireSalon();
  const origin = appUrl();
  const today = toLocalDate(new Date(), salon.timezone);
  const closures = await listClosures(salon.id, today);
  return (
    <>
      <PageHeader title="Postavke" description="Podaci o salonu i pravila online zakazivanja." />
      <div className="space-y-8 px-4 pb-10 sm:px-8">
        <SettingsForm
          origin={origin}
          salon={{
            name: salon.name,
            slug: salon.slug,
            city: salon.city ?? "",
            address: salon.address ?? "",
            phone: salon.phone ?? "",
            email: salon.email ?? "",
            about: salon.about ?? "",
            slotIntervalMin: salon.slotIntervalMin,
            minLeadMin: salon.minLeadMin,
            maxAdvanceDays: salon.maxAdvanceDays,
          }}
        />
        <div className="max-w-5xl lg:pr-[22rem]">
          <Closures today={today} closures={closures.map((c) => ({ id: c.id, startDate: c.startDate, endDate: c.endDate, reason: c.reason }))} />
        </div>
      </div>
    </>
  );
}
