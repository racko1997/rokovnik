import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { formatClock, formatLocalDateLong } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { toLocalDate, toLocalMinutes } from "@/server/domain/time";
import { verifyManageToken } from "@/server/manage-link";
import { getManagedAppointment } from "@/server/services/booking";
import { ManagePanel } from "./manage-panel";

export const metadata: Metadata = { title: "Vaš termin", robots: { index: false } };

export default async function ManageAppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = verifyManageToken(token);
  const appt = id ? await getManagedAppointment(id) : null;
  if (!appt) notFound();

  const tz = appt.salon.timezone;
  const date = toLocalDate(appt.startsAt, tz);
  const salonPhone = appt.salon.phone ? formatPhone(appt.salon.phone) : null;
  const cancelled = appt.status === "cancelled";

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:py-12">
      <BrandMark href={`/s/${appt.salon.slug}`} className="opacity-70" />
      <p className="mt-10 text-sm font-medium text-ink-soft">{appt.salon.name}</p>
      <h1 className="mt-1 font-display text-4xl leading-tight">{cancelled ? "Termin je otkazan" : "Vaš termin"}</h1>

      <div className={`mt-6 rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line ${cancelled ? "opacity-60" : ""}`}>
        <p className="font-display text-2xl leading-tight first-letter:uppercase">{formatLocalDateLong(date)}</p>
        <p className="tabular mt-0.5 text-lg">
          {formatClock(toLocalMinutes(appt.startsAt, tz))}–{formatClock(toLocalMinutes(appt.endsAt, tz))}
        </p>
        <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Usluga</dt>
            <dd className="text-right font-medium">{appt.services.map((s) => s.name).join(" + ")}</dd>
          </div>
          {appt.staff.length > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Kod</dt>
              <dd className="text-right font-medium">{appt.staff.map((s) => s.name).join(", ")}</dd>
            </div>
          )}
          {appt.salon.address && (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Adresa</dt>
              <dd className="text-right">{[appt.salon.address, appt.salon.city].filter(Boolean).join(", ")}</dd>
            </div>
          )}
        </dl>
      </div>

      {appt.canChange ? (
        <ManagePanel
          token={token}
          slug={appt.salon.slug}
          today={toLocalDate(new Date(), tz)}
          serviceIds={appt.services.map((s) => s.id)}
          staffId={appt.staff.length === 1 ? appt.staff[0].id : null}
        />
      ) : (
        <p className="mt-6 text-ink-soft">
          {appt.blockedReason === "cancelled" && (
            <>
              Želite novi termin?{" "}
              <Link href={`/s/${appt.salon.slug}`} className="font-medium text-lacquer underline-offset-4 hover:underline">
                Zakažite ovdje
              </Link>
              .
            </>
          )}
          {appt.blockedReason === "past" && "Ovaj termin je prošao."}
          {(appt.blockedReason === "too_late" || appt.blockedReason === "no_phone") &&
            `Termin se više ne može mijenjati preko interneta. ${salonPhone ? `Pozovite salon: ${salonPhone}.` : "Javite se salonu."}`}
        </p>
      )}
    </div>
  );
}
