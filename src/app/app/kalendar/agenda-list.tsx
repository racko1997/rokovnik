"use client";

import { clsx } from "clsx";
import { MessageSquareText, Sparkles } from "lucide-react";
import { Swatch } from "@/components/ui/swatch";
import { formatClock } from "@/lib/format";
import type { BlockTone } from "./colors";
import { SOURCE_LABEL, STATUS_LABEL, type CalBlock, type CalStaff, type StaffDay } from "./types";

/** Termini dana redom, jedan ispod drugog — pregledno na telefonu. */
export function AgendaList({
  blocks,
  staff,
  staffDays,
  conflictKeys,
  toneFor,
  onSelect,
  nowMin,
  isToday,
}: {
  blocks: CalBlock[];
  staff: CalStaff[];
  staffDays: StaffDay[];
  conflictKeys: Set<string>;
  toneFor: (b: CalBlock) => BlockTone;
  onSelect: (b: CalBlock) => void;
  nowMin: number;
  isToday: boolean;
}) {
  const byId = new Map(staff.map((s) => [s.id, s]));
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.staffId.localeCompare(b.staffId));
  const working = staffDays.filter((d) => d.shifts.length > 0);
  const nextIndex = isToday ? sorted.findIndex((b) => b.endMin > nowMin) : -1;

  return (
    <div className="space-y-4 px-4 pb-24 sm:px-8">
      {working.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {working.map((d) => {
            const s = byId.get(d.staffId);
            if (!s) return null;
            return (
              <span key={d.staffId} className="tabular flex shrink-0 items-center gap-1.5 rounded-full bg-paper py-1 pr-3 pl-1.5 text-xs whitespace-nowrap ring-1 ring-line">
                <Swatch color={s.color} size="sm" />
                <span className="font-medium">{s.name}</span>
                <span className="text-ink-soft">{d.shifts.map((x) => `${formatClock(x.startMin)}–${formatClock(x.endMin)}`).join(", ")}</span>
              </span>
            );
          })}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-4 py-10 text-center text-ink-soft">
          Nema termina ovog dana.
        </p>
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
          {sorted.map((b, i) => {
            const tone = toneFor(b);
            const member = byId.get(b.staffId);
            const conflict = conflictKeys.has(b.key);
            const source = SOURCE_LABEL[b.source];
            const past = isToday && b.endMin <= nowMin;
            return (
              <li key={b.key}>
                {i === nextIndex && (
                  <div className="flex items-center gap-2 bg-lacquer-wash/50 px-4 py-1 text-xs font-semibold text-lacquer">
                    <span className="h-1.5 w-1.5 rounded-full bg-lacquer" /> Sada {formatClock(nowMin)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(b)}
                  className={clsx("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-porcelain/60", past && "opacity-60")}
                >
                  <span className="tabular w-12 shrink-0 pt-0.5">
                    <span className="block font-display text-lg leading-none">{formatClock(b.startMin)}</span>
                    <span className="mt-1 block text-xs text-ink-faint">{formatClock(b.endMin)}</span>
                  </span>
                  <span className="w-1 shrink-0 rounded-full" style={{ background: conflict ? "var(--lacquer)" : tone.accent }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={clsx("truncate font-semibold", b.status === "no_show" && "line-through")}>{b.client?.name ?? "Bez imena"}</span>
                      {b.firstVisit && <Sparkles size={13} className="shrink-0 text-amber" aria-label="Prva posjeta" />}
                      {b.notes && <MessageSquareText size={13} className="shrink-0 text-ink-faint" aria-label="Ima napomenu" />}
                    </span>
                    <span className="block truncate text-sm text-ink-soft">{b.services.map((s) => s.name).join(" + ")}</span>
                    {b.gaps.map((g) => (
                      <span key={g.startMin} className="tabular block text-xs text-mint">
                        djelovanje {formatClock(g.startMin)}–{formatClock(g.endMin)} · radnik slobodan
                      </span>
                    ))}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {member && (
                        <span className="flex items-center gap-1 text-ink-soft">
                          <Swatch color={member.color} size="sm" /> {member.name}
                        </span>
                      )}
                      <span className="rounded-full px-1.5 py-px font-medium" style={{ background: `color-mix(in oklab, ${tone.accent} 14%, transparent)`, color: tone.accent }}>
                        {STATUS_LABEL[b.status]}
                      </span>
                      {source && <span className="rounded-full bg-porcelain px-1.5 py-px text-ink-soft ring-1 ring-line">{source}</span>}
                      {conflict && <span className="font-semibold text-lacquer">van smjene</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
