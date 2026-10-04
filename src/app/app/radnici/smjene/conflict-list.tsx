"use client";

import { ArrowRight, CalendarSearch } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Swatch } from "@/components/ui/swatch";
import { formatClock, formatLocalDateLong } from "@/lib/format";
import { cancelConflictAction, reassignAction } from "./actions";
import type { ConflictWithSuggestions } from "./suggestions";

const REASON: Record<ConflictWithSuggestions["reason"], string> = {
  day_off: "slobodan dan",
  outside_hours: "van radnog vremena",
  time_off: "odsustvo",
};

interface StaffLite {
  id: string;
  name: string;
  color: string;
}

/**
 * Termini koji su ostali van radnog vremena. Za svaki: prebaci kod slobodnog
 * radnika, otvori u kalendaru (da se pomjeri) ili otkaži.
 */
export function ConflictList({
  conflicts,
  staff,
  showStaff = true,
  onResolved,
}: {
  conflicts: ConflictWithSuggestions[];
  staff: StaffLite[];
  showStaff?: boolean;
  onResolved?: (appointmentId: string) => void;
}) {
  const byId = new Map(staff.map((s) => [s.id, s]));
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-lacquer/25">
      {conflicts.map((c) => (
        <ConflictRow key={`${c.appointmentId}:${c.staffId}`} conflict={c} byId={byId} showStaff={showStaff} onResolved={onResolved} />
      ))}
    </ul>
  );
}

function ConflictRow({
  conflict: c,
  byId,
  showStaff,
  onResolved,
}: {
  conflict: ConflictWithSuggestions;
  byId: Map<string, StaffLite>;
  showStaff: boolean;
  onResolved?: (appointmentId: string) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const member = byId.get(c.staffId);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, doneText: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Nije uspjelo.");
      setDone(doneText);
      onResolved?.(c.appointmentId);
    });

  if (done) {
    return <li className="px-4 py-3 text-sm text-mint">✓ {done}</li>;
  }

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="tabular font-medium first-letter:uppercase">
          {formatLocalDateLong(c.date)}, {formatClock(c.startMin)}–{formatClock(c.endMin)}
        </span>
        <span className="rounded-full bg-lacquer-wash px-2 py-0.5 text-xs font-medium text-lacquer-deep">{REASON[c.reason]}</span>
      </div>
      <p className="mt-0.5 text-sm text-ink-soft">
        {c.client?.name ?? "Bez imena"} · {c.services.join(" + ")}
        {showStaff && member && <> · kod: {member.name}</>}
        {c.client?.phone && (
          <>
            {" · "}
            <a href={`tel:${c.client.phone}`} className="tabular underline-offset-2 hover:underline">
              {c.phoneDisplay ?? c.client.phone}
            </a>
          </>
        )}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {c.suggestions.map((id) => {
          const s = byId.get(id);
          if (!s) return null;
          return (
            <button
              key={id}
              type="button"
              disabled={pending}
              onClick={() => run(() => reassignAction(c.appointmentId, c.staffId, id), `Prebačeno kod: ${s.name}`)}
              className="flex items-center gap-1.5 rounded-full bg-mint-wash py-1 pr-3 pl-1.5 text-sm font-medium text-mint ring-1 ring-mint/20 hover:ring-mint/50 disabled:opacity-50"
            >
              <Swatch color={s.color} size="sm" />
              <ArrowRight size={13} /> {s.name}
            </button>
          );
        })}
        {c.suggestions.length === 0 && <span className="text-sm text-ink-faint">Niko drugi nije slobodan u to vrijeme.</span>}
        <Link
          href={`/app/kalendar?d=${c.date}`}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-ink-soft ring-1 ring-line-strong hover:text-ink"
        >
          <CalendarSearch size={14} /> Pomjeri u kalendaru
        </Link>
        {confirmCancel ? (
          <span className="flex items-center gap-1.5 text-sm">
            Otkazati?
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => cancelConflictAction(c.appointmentId), "Termin otkazan")}
              className="rounded-full bg-lacquer px-3 py-1 font-medium text-white hover:bg-lacquer-deep"
            >
              Da
            </button>
            <button type="button" onClick={() => setConfirmCancel(false)} className="rounded-full px-2 py-1 text-ink-soft hover:text-ink">
              Ne
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmCancel(true)} className="rounded-full px-3 py-1 text-sm text-lacquer-deep hover:bg-lacquer-wash">
            Otkaži
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-lacquer-deep">{error}</p>}
    </li>
  );
}
