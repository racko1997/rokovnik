import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { formatInstant } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { platformAdminAccess } from "@/server/admin";
import { listLeads } from "@/server/services/leads";
import { DemoReset } from "./demo-reset";
import { LeadStatus } from "./lead-status";
import { NoAdminAccess } from "./no-access";

export const metadata: Metadata = { title: "Prijave za pilot", robots: { index: false } };

// Obnova demo salona upisuje nekoliko stotina termina
export const maxDuration = 120;

export default async function LeadsPage() {
  const access = await platformAdminAccess();
  if (!access.ok) return <NoAdminAccess email={access.user.email} configured={access.configured} />;
  const leads = await listLeads();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <BrandMark href="/" />
      <h1 className="mt-8 font-display text-4xl">Prijave za pilot</h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">{leads.length} prijava sa naslovne stranice.</p>
        <DemoReset />
      </div>
      {leads.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center text-ink-soft">Još nema prijava.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
          {leads.map((l) => (
            <li key={l.id} className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <p className="font-medium">
                  {l.salonName} {l.city && <span className="font-normal text-ink-soft">· {l.city}</span>}
                </p>
                <p className="text-sm text-ink-soft">
                  {l.contactName} ·{" "}
                  <a href={`tel:${l.phone}`} className="tabular text-lacquer hover:underline">
                    {formatPhone(l.phone)}
                  </a>
                  {l.email && <> · {l.email}</>}
                </p>
                <p className="text-sm text-ink-soft">{[l.salonType, l.staffCount && `radnika: ${l.staffCount}`].filter(Boolean).join(" · ")}</p>
                {l.message && <p className="mt-1 text-sm">„{l.message}“</p>}
                <p className="mt-1 text-xs text-ink-faint">{formatInstant(l.createdAt, "Europe/Sarajevo", { time: true, year: true })}</p>
              </div>
              <LeadStatus id={l.id} status={l.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
