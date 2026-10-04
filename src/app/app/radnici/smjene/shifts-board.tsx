"use client";

import { clsx } from "clsx";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { type Shift, ShiftsInput } from "@/components/shifts-input";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { FormError, Input } from "@/components/ui/field";
import { Swatch } from "@/components/ui/swatch";
import { formatClock, formatLocalDateLong, MONTHS_GENITIVE, plural, WEEKDAYS } from "@/lib/format";
import { clearDayOverrideAction, saveDayOverrideAction } from "./actions";
import { ConflictList } from "./conflict-list";
import type { ConflictWithSuggestions } from "./suggestions";

export interface WeekCell {
  staffId: string;
  date: string;
  shifts: Shift[];
  regular: Shift[];
  isOverride: boolean;
  /** Salon ne radi tog dana (praznik) */
  closedReason: string | null;
  /** Sedmica A (0) / B (1) ako smjene rotiraju */
  rotationWeek: 0 | 1 | null;
  note: string | null;
  absences: { reason: string | null; allDay: boolean; startMin: number; endMin: number }[];
  visits: { startMin: number; endMin: number; client: string; services: string[] }[];
  conflicts: number;
}

interface StaffLite {
  id: string;
  name: string;
  color: string;
}

const shiftLabel = (shifts: Shift[]) =>
  shifts.map((s) => `${formatClock(s.startMin)}–${formatClock(s.endMin)}`).join(" · ");

function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekLabel(days: string[]) {
  const [, m1, d1] = days[0].split("-").map(Number);
  const [, m2, d2] = days[6].split("-").map(Number);
  return m1 === m2 ? `${d1}.–${d2}. ${MONTHS_GENITIVE[m2 - 1]}` : `${d1}. ${MONTHS_GENITIVE[m1 - 1]} – ${d2}. ${MONTHS_GENITIVE[m2 - 1]}`;
}

export function ShiftsBoard({
  canEdit,
  today,
  weekStart,
  days,
  staff,
  cells,
  conflicts,
}: {
  canEdit: boolean;
  today: string;
  weekStart: string;
  days: string[];
  staff: StaffLite[];
  cells: WeekCell[];
  conflicts: ConflictWithSuggestions[];
}) {
  const [editing, setEditing] = useState<WeekCell | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);
  const cell = (staffId: string, date: string) => cells.find((c) => c.staffId === staffId && c.date === date)!;
  const thisWeek = addDays(today, 1 - (new Date(`${today}T12:00:00Z`).getUTCDay() || 7));

  return (
    <div className="space-y-5 px-4 pb-10 sm:px-8">
      {conflicts.length > 0 && (
        <section className="rounded-[var(--radius-card)] bg-lacquer-wash/60 p-4 ring-1 ring-lacquer/20">
          <button type="button" onClick={() => setShowConflicts((v) => !v)} className="flex w-full items-center gap-3 text-left">
            <AlertTriangle size={18} className="shrink-0 text-lacquer" />
            <span className="flex-1">
              <span className="block font-medium text-lacquer-deep">
                {conflicts.length} {plural(conflicts.length, "termin je", "termina su", "termina je")} van radnog vremena
              </span>
              <span className="block text-sm text-ink-soft">Nakon izmjene smjene ili odsustva. Prebacite ih, pomjerite ili otkažite.</span>
            </span>
            <span className="text-sm font-medium text-lacquer">{showConflicts ? "Sakrij" : "Riješi"}</span>
          </button>
          {showConflicts && (
            <div className="mt-4">
              <ConflictList conflicts={conflicts} staff={staff} />
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-full bg-paper ring-1 ring-line-strong">
          <Link href={`?w=${addDays(weekStart, -7)}`} className="rounded-l-full p-2.5 text-ink-soft hover:text-ink" aria-label="Prethodna sedmica">
            <ChevronLeft size={18} />
          </Link>
          <span className="border-x border-line px-3 py-2 text-sm font-medium">{weekLabel(days)}</span>
          <Link href={`?w=${addDays(weekStart, 7)}`} className="rounded-r-full p-2.5 text-ink-soft hover:text-ink" aria-label="Sljedeća sedmica">
            <ChevronRight size={18} />
          </Link>
        </div>
        {weekStart !== thisWeek && (
          <Link href="?" className="rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink">
            Ova sedmica
          </Link>
        )}
      </div>

      {staff.length === 0 ? (
        <p className="text-ink-soft">Prvo dodajte radnike.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
          <table className="w-full min-w-[56rem] border-collapse text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-40 border-b border-line bg-paper px-4 py-3 text-xs font-medium text-ink-faint uppercase">Radnik</th>
                {days.map((d, i) => {
                  const isToday = d === today;
                  return (
                    <th key={d} className="border-b border-l border-line px-3 py-2.5 font-normal">
                      <span className={clsx("block text-xs font-medium uppercase", isToday ? "text-lacquer" : "text-ink-faint")}>{WEEKDAYS[i].short}</span>
                      <span className={clsx("tabular font-display text-lg leading-tight", isToday && "text-lacquer")}>{Number(d.slice(8))}.</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <th className="sticky left-0 z-10 border-b border-line bg-paper px-4 py-2 font-normal">
                    <span className="flex items-center gap-2.5">
                      <Swatch color={s.color} />
                      <span className="font-medium">{s.name}</span>
                    </span>
                  </th>
                  {days.map((d) => (
                    <td key={d} className="border-b border-l border-line p-1.5 align-top">
                      <DayCell cell={cell(s.id, d)} past={d < today} onClick={canEdit ? () => setEditing(cell(s.id, d)) : undefined} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={clsx("text-sm text-ink-faint", !canEdit && "hidden")}>
        Redovni raspored (koji važi svake sedmice) mijenjate na kartici{" "}
        <Link href="/app/radnici" className="text-lacquer hover:underline">
          Radnici
        </Link>
        .
      </p>

      <DaySheet key={editing ? `${editing.staffId}:${editing.date}` : "none"} cell={editing} staff={staff} onClose={() => setEditing(null)} />
    </div>
  );
}

function DayCell({ cell, past, onClick }: { cell: WeekCell; past: boolean; onClick?: () => void }) {
  const working = cell.shifts.length > 0;
  const allDayAbsence = cell.absences.find((a) => a.allDay);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={clsx(
        "flex min-h-24 w-full flex-col items-start gap-1 rounded-lg p-2.5 text-left transition-shadow enabled:hover:shadow-[var(--shadow-lift)] disabled:cursor-default",
        allDayAbsence
          ? "bg-amber-wash/70"
          : working
            ? "bg-porcelain/60 ring-1 ring-line ring-inset"
            : "[background-image:repeating-linear-gradient(135deg,transparent_0_6px,var(--line)_6px_7px)]",
        cell.conflicts > 0 && "ring-2 ring-lacquer ring-inset",
        past && "opacity-55",
      )}
    >
      {allDayAbsence ? (
        <span className="text-sm font-medium text-amber">{allDayAbsence.reason || "Odsutan/na"}</span>
      ) : cell.closedReason ? (
        <span className="text-sm font-medium text-ink-soft">Zatvoreno: {cell.closedReason}</span>
      ) : working ? (
        <span className="tabular text-[0.9375rem] leading-snug font-medium">{shiftLabel(cell.shifts)}</span>
      ) : (
        <span className="text-sm text-ink-faint">Slobodan</span>
      )}
      {cell.rotationWeek !== null && !cell.isOverride && !cell.closedReason && (
        <span className="rounded-full bg-porcelain px-1.5 py-px text-[0.6875rem] font-medium text-ink-soft ring-1 ring-line">
          sedmica {cell.rotationWeek === 0 ? "A" : "B"}
        </span>
      )}
      {cell.isOverride && (
        <span className="rounded-full bg-lacquer-wash px-1.5 py-px text-[0.6875rem] font-medium text-lacquer-deep" title={cell.note ?? undefined}>
          izmjena{cell.note ? `: ${cell.note}` : ""}
        </span>
      )}
      {cell.absences
        .filter((a) => !a.allDay)
        .map((a, i) => (
          <span key={i} className="tabular rounded-full bg-amber-wash px-1.5 py-px text-[0.6875rem] font-medium text-amber">
            {a.reason || "Odsutan/na"} {formatClock(a.startMin)}–{formatClock(a.endMin)}
          </span>
        ))}
      <span className="mt-auto flex flex-wrap gap-x-2 text-xs">
        {cell.visits.length > 0 && (
          <span className="text-ink-soft">
            {cell.visits.length} {plural(cell.visits.length, "termin", "termina", "termina")}
          </span>
        )}
        {cell.conflicts > 0 && <span className="font-semibold text-lacquer">{cell.conflicts} za riješiti</span>}
      </span>
    </button>
  );
}

function DaySheet({ cell, staff, onClose }: { cell: WeekCell | null; staff: StaffLite[]; onClose: () => void }) {
  const member = staff.find((s) => s.id === cell?.staffId);
  const [working, setWorking] = useState(Boolean(cell?.shifts.length));
  const [shifts, setShifts] = useState<Shift[]>(
    cell?.shifts.length ? cell.shifts : cell?.regular.length ? cell.regular : [{ startMin: 9 * 60, endMin: 17 * 60 }],
  );
  const [note, setNote] = useState(cell?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictWithSuggestions[] | null>(null);
  const [pending, start] = useTransition();

  if (!cell) return null;

  function save() {
    start(async () => {
      const res = await saveDayOverrideAction({ staffId: cell!.staffId, date: cell!.date, shifts: working ? shifts : [], note });
      if (!res.ok) return setError(res.error);
      setError(null);
      if (res.data.length) setConflicts(res.data);
      else onClose();
    });
  }

  function reset() {
    start(async () => {
      const res = await clearDayOverrideAction(cell!.staffId, cell!.date);
      if (!res.ok) return setError(res.error);
      if (res.data.length) setConflicts(res.data);
      else onClose();
    });
  }

  return (
    <Sheet
      wide
      open
      onOpenChange={(o) => !o && onClose()}
      title={member ? `${member.name}` : "Smjena"}
      description={<span className="first-letter:uppercase">{formatLocalDateLong(cell.date)}</span>}
      footer={
        conflicts ? (
          <div className="flex justify-end">
            <Button onClick={onClose}>Gotovo</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {cell.isOverride ? (
              <Button variant="ghost" onClick={reset} disabled={pending}>
                Vrati na redovni raspored
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={save} disabled={pending}>
              {pending ? "Spremam…" : "Spremi za ovaj dan"}
            </Button>
          </div>
        )
      }
    >
      {conflicts ? (
        <div className="space-y-4">
          <div>
            <p className="font-display text-xl">Spremljeno. Ovi termini su sada van radnog vremena:</p>
            <p className="mt-1 text-sm text-ink-soft">
              Prebacite ih kod nekog ko je slobodan, pomjerite u kalendaru ili otkažite. Do tada ostaju u kalendaru označeni crvenom bojom.
            </p>
          </div>
          <ConflictList conflicts={conflicts} staff={staff} showStaff={false} />
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-ink-soft">
            Redovno{cell.rotationWeek !== null && ` (sedmica ${cell.rotationWeek === 0 ? "A" : "B"})`}:{" "}
            <span className="tabular font-medium text-ink">{cell.regular.length ? shiftLabel(cell.regular) : "ne radi"}</span>
            {cell.closedReason && <span className="ml-2 rounded-full bg-porcelain px-2 py-0.5 text-xs font-medium text-ink-soft ring-1 ring-line">salon zatvoren: {cell.closedReason}</span>}
            {cell.isOverride && <span className="ml-2 rounded-full bg-lacquer-wash px-2 py-0.5 text-xs font-medium text-lacquer-deep">ovaj dan je izmijenjen</span>}
          </p>

          <fieldset className="space-y-3">
            <legend className="sr-only">Ovaj dan</legend>
            <div className="flex w-fit gap-1 rounded-full bg-porcelain p-1 text-sm ring-1 ring-line">
              {[
                [true, "Radi"],
                [false, "Slobodan dan"],
              ].map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setWorking(value as boolean)}
                  aria-pressed={working === value}
                  className={clsx("rounded-full px-4 py-1.5 font-medium", working === value ? "bg-ink text-porcelain" : "text-ink-soft")}
                >
                  {label as string}
                </button>
              ))}
            </div>
            {working && <ShiftsInput value={shifts} onChange={setShifts} />}
          </fieldset>

          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Napomena (nije obavezno), npr. doktor, seminar" className="h-10" />

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
              Termini tog dana {cell.visits.length > 0 && `(${cell.visits.length})`}
            </h3>
            {cell.visits.length === 0 ? (
              <p className="text-sm text-ink-soft">Nema zakazanih termina.</p>
            ) : (
              <ul className="divide-y divide-line rounded-[var(--radius-chip)] ring-1 ring-line">
                {cell.visits.map((v, i) => {
                  const covered = working && shifts.some((s) => s.startMin <= v.startMin && v.endMin <= s.endMin);
                  return (
                    <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="tabular w-24 shrink-0 font-medium">
                        {formatClock(v.startMin)}–{formatClock(v.endMin)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {v.client} · <span className="text-ink-soft">{v.services.join(" + ")}</span>
                      </span>
                      {!covered && <span className="shrink-0 text-xs font-medium text-lacquer">van smjene</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {cell.visits.some((v) => !(working && shifts.some((s) => s.startMin <= v.startMin && v.endMin <= s.endMin))) && (
              <p className="mt-2 text-sm text-lacquer-deep">
                Nakon spremanja dobićete listu ovih termina da ih prebacite, pomjerite ili otkažete.
              </p>
            )}
          </section>

          <FormError message={error} />
        </div>
      )}
    </Sheet>
  );
}
