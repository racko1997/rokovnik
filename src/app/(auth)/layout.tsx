import { BrandMark } from "@/components/brand-mark";
import { swatch } from "@/lib/swatches";

const PREVIEW = [
  { time: "09:00", name: "Milica K.", service: "Žensko šišanje", color: "rubin", h: 3 },
  { time: "09:45", name: "Haris S.", service: "Muško šišanje", color: "plavocrna", h: 2 },
  { time: "10:15", name: "Ivana H.", service: "Gel lak", color: "kadulja", h: 4 },
  { time: "11:15", name: "Jasmina B.", service: "Farbanje izrastka", color: "ljubicasta", h: 5 },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <BrandMark />
        <main className="flex flex-1 items-center py-12">
          <div className="w-full max-w-sm animate-[rise_300ms_ease-out]">{children}</div>
        </main>
      </div>

      <aside aria-hidden className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(var(--porcelain)_1px,transparent_1px)] [background-size:100%_44px]" />
        <div className="relative flex h-full flex-col justify-center px-16">
          <p className="font-display text-[2.6rem] leading-[1.1] text-porcelain">
            Telefon zvoni
            <br />
            dok šišate?
          </p>
          <p className="mt-4 max-w-sm text-porcelain/60">
            Rokovnik vodi raspored, a recepcioner odgovara klijentima umjesto vas.
          </p>
          <ol className="mt-12 max-w-sm space-y-2">
            {PREVIEW.map((p) => (
              <li
                key={p.time}
                className="flex items-stretch gap-3 rounded-lg bg-white/[0.04] py-2.5 pr-3 pl-0 ring-1 ring-white/10"
                style={{ minHeight: `${p.h * 0.75 + 1.5}rem` }}
              >
                <span className="w-1 rounded-r" style={{ background: swatch(p.color).hex }} />
                <span className="tabular w-11 pt-px text-sm text-porcelain/50">{p.time}</span>
                <span>
                  <span className="block text-sm font-medium text-porcelain">{p.name}</span>
                  <span className="block text-sm text-porcelain/50">{p.service}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
