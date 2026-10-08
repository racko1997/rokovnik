"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";

export interface ChartPoint {
  /** Oznaka na osi ("12", "Pon", "od 6. okt") */
  label: string;
  /** Puni naziv u tooltipu ("utorak, 7. oktobra") */
  title: string;
  revenueCents: number;
  upcomingCents: number;
  visits: number;
}

// Ista boja, dva koraka (provjereno validatorom): ostvareno puno, zakazano svjetlije
const DONE = "#b0174f";
const UPCOMING = "#d4708f";
const HEIGHT = 200;

/** Prihod po danu (ili sedmici): stubci od zajedničke osnove, tooltip na hover i fokus. */
export function RevenueChart({ points, currency }: { points: ChartPoint[]; currency: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.revenueCents + p.upcomingCents), 0);
  const step = niceStep(max / 3);
  const top = Math.max(step * 3, 1);
  const ticks = [0, step, step * 2, step * 3];
  const hasUpcoming = points.some((p) => p.upcomingCents > 0);
  const labelEvery = Math.ceil(points.length / 10);
  const fmt = (c: number) => formatPrice(c, currency);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DONE }} /> Ostvareno
        </span>
        {hasUpcoming && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: UPCOMING }} /> Zakazano
          </span>
        )}
      </div>

      <div className="relative flex gap-2">
        {/* Osa: zaokružene vrijednosti */}
        <div className="relative w-12 shrink-0 text-right text-[0.6875rem] text-ink-faint tabular" style={{ height: HEIGHT }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: HEIGHT - (t / top) * HEIGHT }}>
              {compact(t)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Mreža: tanke, mirne linije */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ top: HEIGHT - (t / top) * HEIGHT }} />
          ))}

          <div className="relative flex items-end" style={{ height: HEIGHT }} onMouseLeave={() => setActive(null)}>
            {points.map((p, i) => {
              const doneH = (p.revenueCents / top) * HEIGHT;
              const upH = (p.upcomingCents / top) * HEIGHT;
              const both = doneH > 0 && upH > 0;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`${p.title}: ostvareno ${fmt(p.revenueCents)}${p.upcomingCents ? `, zakazano ${fmt(p.upcomingCents)}` : ""}, ${p.visits} termina`}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <span className={`absolute inset-x-0 inset-y-0 rounded-md ${active === i ? "bg-porcelain" : ""} group-focus-visible:ring-2 group-focus-visible:ring-lacquer`} />
                  {/* Zakazano iznad ostvarenog, razdvojeno razmakom od 2px */}
                  {upH > 0 && (
                    <span
                      className="relative w-full max-w-6 rounded-t-[4px]"
                      style={{ height: Math.max(upH - (both ? 2 : 0), 2), background: UPCOMING, marginBottom: both ? 2 : 0 }}
                    />
                  )}
                  {doneH > 0 && (
                    <span
                      className={`relative w-full max-w-6 ${both ? "" : "rounded-t-[4px]"}`}
                      style={{ height: Math.max(doneH, 2), background: DONE }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tooltip: vrijednosti prve, oznake poslije */}
          {active !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 w-max -translate-x-1/2 -translate-y-full rounded-lg bg-paper px-3 py-2 text-xs shadow-[var(--shadow-pop)] ring-1 ring-line"
              style={{ left: `${((active + 0.5) / points.length) * 100}%` }}
            >
              <p className="font-medium text-ink first-letter:uppercase">{points[active].title}</p>
              {(points[active].revenueCents > 0 || points[active].upcomingCents === 0) && (
                <p className="mt-1 text-ink-soft">
                  <strong className="font-semibold text-ink tabular">{fmt(points[active].revenueCents)}</strong> ostvareno
                </p>
              )}
              {points[active].upcomingCents > 0 && (
                <p className="text-ink-soft">
                  <strong className="font-semibold text-ink tabular">{fmt(points[active].upcomingCents)}</strong> zakazano
                </p>
              )}
              <p className="text-ink-soft">
                <strong className="font-semibold text-ink tabular">{points[active].visits}</strong> termina
              </p>
            </div>
          )}

          <div className="mt-2 flex text-[0.6875rem] text-ink-faint">
            {points.map((p, i) => (
              <span key={i} className="flex-1 text-center tabular">
                {i % labelEvery === 0 ? p.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Zaokružen korak ose u feninzima: 1/2/2.5/5 × 10ⁿ KM */
function niceStep(raw: number): number {
  if (raw <= 0) return 1000;
  const km = raw / 100;
  const pow = 10 ** Math.floor(Math.log10(km));
  const n = km / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow * 100;
}

function compact(cents: number): string {
  const km = cents / 100;
  // Bez lokalizacije preglednika (isti ispis na serveru i klijentu)
  if (km >= 1000) return `${(km / 1000).toFixed(1).replace(/\.0$/, "").replace(".", ",")}k`;
  return String(Math.round(km));
}
