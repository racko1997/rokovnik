"use client";

import { X } from "lucide-react";
import { formatClock } from "@/lib/format";

export interface Shift {
  startMin: number;
  endMin: number;
}

const toMin = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
};

const timeClass = "tabular h-9 rounded-md bg-paper px-2 text-sm ring-1 ring-line-strong focus:ring-2 focus:ring-lacquer focus:outline-none";

/** Smjene jednog dana: početak–kraj, uz mogućnost pauze (podijeljena smjena). */
export function ShiftsInput({ value, onChange, label = "" }: { value: Shift[]; onChange: (v: Shift[]) => void; label?: string }) {
  const set = (i: number, patch: Partial<Shift>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((s, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="mr-0.5 text-xs text-ink-faint">pauza, pa</span>}
          <input type="time" step={900} value={formatClock(s.startMin)} onChange={(e) => set(i, { startMin: toMin(e.target.value) })} className={timeClass} aria-label={`${label} početak smjene ${i + 1}`} />
          <span className="text-ink-faint">–</span>
          <input type="time" step={900} value={formatClock(s.endMin)} onChange={(e) => set(i, { endMin: toMin(e.target.value) })} className={timeClass} aria-label={`${label} kraj smjene ${i + 1}`} />
          {i > 0 && (
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded p-1 text-ink-faint hover:text-lacquer" aria-label="Ukloni pauzu">
              <X size={14} />
            </button>
          )}
        </span>
      ))}
      {value.length === 1 && (
        <button
          type="button"
          className="text-sm text-ink-soft hover:text-lacquer"
          onClick={() => {
            const s = value[0];
            const mid = Math.round((s.startMin + s.endMin) / 2 / 30) * 30;
            onChange([
              { ...s, endMin: mid - 30 },
              { ...s, startMin: mid + 30 },
            ]);
          }}
        >
          + pauza
        </button>
      )}
    </div>
  );
}
