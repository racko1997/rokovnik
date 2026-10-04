import { Check } from "lucide-react";
import { Swatch } from "@/components/ui/swatch";
import { swatch } from "@/lib/swatches";

/**
 * Glavna scena naslovne: poruka stiže → recepcioner odgovara → termin se
 * pojavljuje u kalendaru. Jedna orkestrirana animacija pri učitavanju (CSS),
 * bez JavaScripta; uz "reduced motion" sve je odmah vidljivo.
 */
const COLS = [
  { name: "Lana", color: "rubin", blocks: [{ top: 0, h: 2, who: "Merima K.", what: "Žensko šišanje" }, { top: 3, h: 3, who: "Jasmina B.", what: "Izrastak" }] },
  { name: "Dino", color: "plavocrna", blocks: [{ top: 0, h: 1, who: "Haris S.", what: "Muško šišanje" }, { top: 2, h: 2, who: "Adnan I.", what: "Šišanje + brada" }, { top: 5, h: 1, who: "Emir H.", what: "Brada" }] },
  { name: "Amra", color: "ljubicasta", blocks: [{ top: 0, h: 2, who: "Nermina D.", what: "Šišanje + feniranje" }] },
];
const ROW = 30;

export function HeroScene() {
  const amra = swatch("ljubicasta").hex;
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[34rem] select-none lg:mr-0">
      {/* Kalendar */}
      <div className="rounded-[1.25rem] bg-paper p-4 shadow-[var(--shadow-pop)] ring-1 ring-line sm:p-5">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-xl">Sutra</p>
          <p className="tabular text-xs text-ink-faint">6 termina · 3 radnika</p>
        </div>
        <div className="mt-3 grid grid-cols-[1.75rem_repeat(3,minmax(0,1fr))] gap-x-1.5">
          <span />
          {COLS.map((c) => (
            <span key={c.name} className="flex items-center gap-1.5 pb-2 text-xs font-medium">
              <Swatch color={c.color} size="sm" /> {c.name}
            </span>
          ))}
          <div className="relative" style={{ height: ROW * 7 }}>
            {["15", "16", "17", "18"].map((h, i) => (
              <span key={h} className="tabular absolute right-1 font-display text-[0.6875rem] text-ink-faint" style={{ top: i * ROW * 2 - 6 }}>
                {h}
              </span>
            ))}
          </div>
          {COLS.map((c, ci) => (
            <div
              key={c.name}
              className="relative rounded-md bg-porcelain/60 [background-image:linear-gradient(var(--line)_1px,transparent_1px)]"
              style={{ height: ROW * 7, backgroundSize: `100% ${ROW * 2}px` }}
            >
              {c.blocks.map((b) => (
                <div
                  key={b.who}
                  className="absolute inset-x-0.5 overflow-hidden rounded-[5px] px-1.5 py-1"
                  style={{
                    top: b.top * ROW + 1,
                    height: b.h * ROW - 2,
                    background: `color-mix(in oklab, ${swatch(c.color).hex} 12%, var(--paper))`,
                    boxShadow: `inset 2px 0 0 ${swatch(c.color).hex}`,
                  }}
                >
                  <p className="truncate text-[0.6875rem] leading-tight font-semibold">{b.who}</p>
                  {b.h > 1 && <p className="truncate text-[0.625rem] text-ink-soft">{b.what}</p>}
                </div>
              ))}
              {ci === 2 && (
                // Novi termin koji je upisao recepcioner
                <div
                  className="absolute inset-x-0.5 overflow-hidden rounded-[5px] px-1.5 py-1 anim-drop-in"
                  style={{
                    animationDelay: "3.1s",
                    top: 5 * ROW + 1,
                    height: 2 * ROW - 2,
                    background: `color-mix(in oklab, ${amra} 16%, var(--paper))`,
                    boxShadow: `inset 2px 0 0 ${amra}, 0 0 0 2px color-mix(in oklab, ${amra} 35%, transparent)`,
                  }}
                >
                  <p className="truncate text-[0.6875rem] leading-tight font-semibold">Sanela H.</p>
                  <p className="truncate text-[0.625rem] text-ink-soft">Farbanje izrastka</p>
                  <p className="tabular mt-0.5 text-[0.625rem] font-medium" style={{ color: amra }}>
                    AI chat
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Razgovor */}
      <div className="relative z-10 -mt-16 mr-auto ml-0 w-[78%] rounded-[1.25rem] bg-paper p-4 shadow-[var(--shadow-pop)] ring-1 ring-line sm:-mt-20 sm:-ml-10 sm:w-[64%]">
        <div className="flex items-center gap-2 border-b border-line pb-2.5 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" />
          <span className="font-medium">Instagram poruka</span>
          <span className="tabular ml-auto text-ink-faint">21:47</span>
        </div>
        <div className="space-y-2 pt-3 text-[0.875rem] leading-snug">
          <p className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-porcelain px-3 py-2 anim-appear" style={{ animationDelay: "0.3s" }}>
            Ćao, ima li sutra iza 5 nešto za izrastak?
          </p>
          <div className="relative">
            <p className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-ink px-3 py-2 text-porcelain anim-appear" style={{ animationDelay: "1.8s" }}>
              Ima kod Amre u 17:30 — farbanje izrastka traje oko sat i po, od 60 KM. Da upišem?
            </p>
            {/* "Kuca…" dok stigne odgovor */}
            <p className="absolute top-0 right-0 flex gap-1 rounded-2xl rounded-br-md bg-ink/90 px-3 py-2.5 anim-typing" style={{ animationDelay: "0.9s" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-porcelain/70" />
              ))}
            </p>
          </div>
          <p className="w-fit rounded-2xl rounded-bl-md bg-porcelain px-3 py-2 anim-appear" style={{ animationDelay: "2.6s" }}>
            Može 🙏 Sanela, 061 222 909
          </p>
        </div>
      </div>

      {/* Potvrda */}
      <div className="absolute -top-4 right-3 z-20 flex items-center gap-2 rounded-full bg-mint px-3.5 py-2 text-xs font-medium text-white shadow-[var(--shadow-pop)] anim-appear sm:right-4" style={{ animationDelay: "3.5s" }}>
        <Check size={14} strokeWidth={3} /> Upisano u kalendar — bez ijednog poziva
      </div>
    </div>
  );
}
