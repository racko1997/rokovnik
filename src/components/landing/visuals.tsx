import { AlertTriangle, ArrowRight, CalendarSearch, Check, Search } from "lucide-react";
import { Swatch } from "@/components/ui/swatch";
import { swatch } from "@/lib/swatches";

const card = "rounded-[1.25rem] bg-paper shadow-[var(--shadow-lift)] ring-1 ring-line";

/** Smjene + rješavanje termina kad radnik uzme slobodan dan. */
export function ShiftsVisual() {
  const days = ["Pon", "Uto", "Sri", "Čet", "Pet"];
  const rows = [
    { name: "Lana", color: "rubin", cells: ["09–17", "09–17", "09–17", "09–17", "09–17"] },
    { name: "Amra", color: "ljubicasta", cells: ["12–20", "09–13 · 14–18", "slobodan", "09–13 · 14–18", "12–20"] },
    { name: "Dino", color: "plavocrna", cells: ["10–18", "10–18", "10–18", "10–18", "10–18"] },
  ];
  return (
    <div aria-hidden className="relative">
      <div className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-[5.5rem_repeat(5,minmax(0,1fr))] border-b border-line text-[0.6875rem] font-medium text-ink-faint uppercase">
          <span className="px-3 py-2">Radnik</span>
          {days.map((d) => (
            <span key={d} className="border-l border-line px-2 py-2">
              {d}
            </span>
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.name} className="grid grid-cols-[5.5rem_repeat(5,minmax(0,1fr))] border-b border-line last:border-0">
            <span className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium">
              <Swatch color={r.color} size="sm" /> {r.name}
            </span>
            {r.cells.map((c, i) => (
              <span key={i} className="border-l border-line p-1">
                <span
                  className={
                    c === "slobodan"
                      ? "flex h-full flex-col justify-between rounded-md bg-porcelain/50 p-1.5 text-[0.625rem] text-ink-faint ring-2 ring-lacquer ring-inset"
                      : "flex h-full rounded-md bg-porcelain/70 p-1.5 text-[0.625rem] font-medium tabular-nums ring-1 ring-line ring-inset"
                  }
                >
                  {c === "slobodan" ? (
                    <>
                      Slobodan
                      <span className="font-semibold text-lacquer">2 za riješiti</span>
                    </>
                  ) : (
                    c
                  )}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className={`${card} relative z-10 -mt-6 ml-6 p-4 sm:ml-16`}>
        <p className="flex items-center gap-2 text-sm font-medium text-lacquer-deep">
          <AlertTriangle size={15} className="text-lacquer" /> Amra u srijedu ne radi — 2 termina
        </p>
        <div className="mt-3 space-y-2.5 text-sm">
          <div>
            <p className="tabular font-medium">13:30–14:45 · Nermina D.</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-mint-wash py-1 pr-3 pl-1.5 text-xs font-medium text-mint ring-1 ring-mint/20">
                <Swatch color="rubin" size="sm" /> <ArrowRight size={12} /> Lana
              </span>
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-ink-soft ring-1 ring-line-strong">
                <CalendarSearch size={12} /> Pomjeri
              </span>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-mint">
            <Check size={13} strokeWidth={3} /> 16:00 · Sanela H. — prebačeno kod Lane
          </p>
        </div>
      </div>
    </div>
  );
}

/** Stranica za online zakazivanje na telefonu. */
export function BookingVisual() {
  const days = [
    ["PON", "12", true],
    ["UTO", "13", true],
    ["SRI", "14", false],
    ["ČET", "15", true],
    ["PET", "16", true],
  ] as const;
  const slots = ["10:00", "10:15", "10:45", "11:30", "13:00", "13:15", "14:30", "16:00"];
  return (
    <div
      aria-hidden
      className="booking-phone mx-auto flex min-h-[28.5rem] w-[17.5rem] rounded-[2.25rem] bg-ink p-2.5 shadow-[var(--shadow-pop)]"
    >
      <div className="flex min-h-full flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-porcelain">
        <div className="bg-paper px-4 pt-7 pb-5">
          <p className="text-[0.6875rem] text-ink-soft">Sarajevo · Ferhadija 12</p>
          <p className="font-display text-xl leading-tight">Studio Lana</p>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="rounded-xl bg-paper p-3.5 ring-1 ring-line">
            <p className="flex items-center justify-between text-xs">
              <span className="font-medium">Muško šišanje · 30 min</span>
              <span className="tabular font-semibold">15 KM</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-ink-soft">
              <Swatch color="plavocrna" size="sm" /> kod: Dino
            </p>
          </div>
          <div className="rounded-xl bg-paper p-3.5 ring-1 ring-line">
            <div className="flex gap-1">
              {days.map(([d, n, free], i) => (
                <span
                  key={d}
                  className={`flex flex-1 flex-col items-center rounded-lg py-1.5 text-[0.5625rem] font-medium ${
                    i === 1 ? "bg-ink text-porcelain" : free ? "ring-1 ring-line-strong" : "text-ink-faint"
                  }`}
                >
                  {d}
                  <span className="font-display text-sm leading-tight">{n}</span>
                  <span className={`mt-0.5 h-1 w-1 rounded-full ${free ? (i === 1 ? "bg-porcelain" : "bg-mint") : ""}`} />
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1">
              {slots.map((s) => (
                <span
                  key={s}
                  className={`tabular rounded-md py-1.5 text-center text-[0.6875rem] font-medium ${
                    s === "13:15" ? "bg-lacquer text-white" : "ring-1 ring-line-strong"
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <span className="mt-auto block rounded-full bg-lacquer py-3 text-center text-xs font-medium text-white">Potvrdi termin</span>
        </div>
      </div>
    </div>
  );
}

/** Razgovor s AI recepcionerom i koraci koje je napravio. */
export function AgentVisual() {
  const selma = swatch("kadulja").hex;
  return (
    <div aria-hidden className={`${card} p-4 sm:p-5`}>
      <div className="space-y-2.5 text-sm leading-snug">
        <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-porcelain px-3 py-2">Treba mi gel lak u utorak ujutro</p>
        <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-porcelain px-2.5 py-1 text-[0.6875rem] text-ink-soft ring-1 ring-line">
          <Search size={11} /> Provjerio slobodne termine · utorak
        </p>
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3 py-2 text-porcelain">
          Ujutro je sve zauzeto, ali kod Selme ima u 13:25 ili 13:45. Odgovara li?
        </p>
        <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-porcelain px-3 py-2">Može 13:25. Lejla, 061 777 123</p>
        <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-mint-wash px-2.5 py-1 text-[0.6875rem] font-medium text-mint">
          <Check size={11} strokeWidth={3} /> Upisao termin · utorak 13:25 kod Selme
        </p>
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3 py-2 text-porcelain">
          Upisano! Vidimo se u utorak u 13:25 kod Selme.
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-soft">
        <span className="h-2 w-2 rounded-full" style={{ background: selma }} />
        Termin se odmah vidi u kalendaru salona, označen kao „AI chat“.
      </div>
    </div>
  );
}
