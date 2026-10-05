"use client";

import { clsx } from "clsx";
import { Check, Copy, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/field";
import { Swatch } from "@/components/ui/swatch";
import { formatClock, formatDuration, WEEKDAYS } from "@/lib/format";
import { SALON_TEMPLATES, type ServiceTemplate } from "@/lib/service-templates";
import { nextFreeSwatch } from "@/lib/swatches";
import { quickSetupAction } from "./actions";

type Step = 1 | 2 | 3 | "done";

interface DraftService extends ServiceTemplate {
  id: string;
  category: string;
  selected: boolean;
}

interface DraftStaff {
  id: string;
  name: string;
  isMe: boolean;
}

interface DayHours {
  weekday: number;
  open: boolean;
  start: string;
  end: string;
}

const STEPS = [
  { n: 1, label: "Usluge" },
  { n: 2, label: "Radnici" },
  { n: 3, label: "Radno vrijeme" },
] as const;

const toMin = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
};

const DEFAULT_HOURS: DayHours[] = WEEKDAYS.map((d) => ({
  weekday: d.iso,
  open: d.iso <= 6,
  start: "09:00",
  end: d.iso === 6 ? "15:00" : "19:00",
}));

export function SetupWizard({
  salonName,
  bookingUrl,
  ownerName,
  existing,
}: {
  salonName: string;
  bookingUrl: string;
  ownerName: string;
  existing: { services: number; staff: number };
}) {
  const [step, setStep] = useState<Step>(1);
  const [templates, setTemplates] = useState<string[]>([]);
  const [services, setServices] = useState<DraftService[]>([]);
  const [staff, setStaff] = useState<DraftStaff[]>([{ id: "me", name: ownerName, isMe: true }]);
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ staff: number; services: number } | null>(null);
  const [pending, start] = useTransition();

  // Funkcijska ažuriranja: brzi uzastopni klikovi ne gaze jedan drugog
  function toggleTemplate(key: string) {
    const tpl = SALON_TEMPLATES.find((t) => t.key === key)!;
    const on = templates.includes(key);
    setTemplates((list) => (on ? list.filter((k) => k !== key) : [...list, key]));
    setServices((list) =>
      on
        ? list.filter((s) => !s.id.startsWith(`${key}:`))
        : [...list.filter((s) => !s.id.startsWith(`${key}:`)), ...tpl.services.map((s, i) => ({ ...s, id: `${key}:${i}`, category: tpl.category, selected: true }))],
    );
  }


  const update = (id: string, patch: Partial<DraftService>) => setServices((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const chosen = services.filter((s) => s.selected && s.name.trim());
  const people = staff.filter((s) => s.name.trim().length >= 2);
  const openDays = hours.filter((h) => h.open);
  const hoursValid = openDays.length > 0 && openDays.every((h) => toMin(h.start) < toMin(h.end));

  function finish() {
    setError(null);
    start(async () => {
      const res = await quickSetupAction({
        services: chosen.map((s) => ({
          categoryName: s.category,
          name: s.name.trim(),
          durationMin: s.durationMin,
          price: s.price,
          priceFrom: Boolean(s.priceFrom),
          bufferMin: s.bufferMin ?? 0,
          gapStartMin: s.gapStartMin ?? 0,
          gapMin: s.gapMin ?? 0,
          bookableOnline: s.bookableOnline ?? true,
        })),
        staff: people.map((s) => ({ name: s.name.trim(), isMe: s.isMe })),
        hours: openDays.map((h) => ({ weekday: h.weekday, startMin: toMin(h.start), endMin: toMin(h.end) })),
      });
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      setStep("done");
    });
  }

  if (step === "done" && result) return <Done salonName={salonName} bookingUrl={bookingUrl} result={result} />;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-8 sm:pt-10">
      <p className="text-sm text-ink-soft">Brzo postavljanje · {salonName}</p>
      <h1 className="mt-1 font-display text-3xl leading-tight sm:text-4xl">
        {step === 1 && "Koje usluge radite?"}
        {step === 2 && "Ko radi u salonu?"}
        {step === 3 && "Kada radite?"}
      </h1>

      <ol className="mt-5 flex items-center gap-2 text-sm">
        {STEPS.map((s, i) => {
          const done = typeof step === "number" && step > s.n;
          const active = step === s.n;
          return (
            <li key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-6 bg-line-strong" />}
              <span
                className={clsx(
                  "tabular flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  done ? "bg-ink text-porcelain" : active ? "bg-lacquer text-white" : "bg-porcelain text-ink-faint ring-1 ring-line",
                )}
              >
                {done ? <Check size={12} strokeWidth={3} /> : s.n}
              </span>
              <span className={active ? "font-medium" : "text-ink-soft"}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {(existing.services > 0 || existing.staff > 0) && step === 1 && (
        <p className="mt-5 rounded-[var(--radius-chip)] bg-amber-wash px-3 py-2.5 text-sm text-amber">
          Salon već ima {existing.services} usluga i {existing.staff} radnika — ovo će se dodati uz postojeće.
        </p>
      )}

      <div className="mt-8">
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid gap-2 sm:grid-cols-2">
              {SALON_TEMPLATES.map((t) => {
                const on = templates.includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTemplate(t.key)}
                    className={clsx(
                      "flex items-start gap-3 rounded-[var(--radius-card)] p-4 text-left ring-1 transition-colors",
                      on ? "bg-lacquer-wash/50 ring-lacquer" : "bg-paper ring-line hover:ring-line-strong",
                    )}
                  >
                    <span
                      className={clsx(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] ring-1",
                        on ? "bg-lacquer text-white ring-lacquer" : "bg-paper ring-line-strong",
                      )}
                    >
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span>
                      <span className="block font-medium">{t.label}</span>
                      <span className="block text-sm text-ink-soft">{t.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {services.length > 0 && (
              <section>
                <p className="mb-2 text-sm text-ink-soft">
                  Okvirne cijene — prepravite ih po svom cjenovniku. Isključite usluge koje ne radite.
                </p>
                <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
                  {services.map((s) => (
                    <li key={s.id} className={clsx("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5", !s.selected && "opacity-50")}>
                      <input
                        type="checkbox"
                        checked={s.selected}
                        onChange={(e) => update(s.id, { selected: e.target.checked })}
                        className="h-4 w-4 accent-[var(--lacquer)]"
                        aria-label={`Uključi ${s.name}`}
                      />
                      <Input value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} className="h-9 min-w-40 flex-1" aria-label="Naziv usluge" />
                      <span className="flex items-center gap-1 text-sm text-ink-soft">
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={s.durationMin}
                          onChange={(e) => update(s.id, { durationMin: Number(e.target.value) || 0 })}
                          className="h-9 w-16 px-2 text-center"
                          aria-label="Trajanje (min)"
                        />
                        min
                      </span>
                      <span className="flex items-center gap-1 text-sm text-ink-soft">
                        {s.priceFrom && "od"}
                        <Input
                          type="number"
                          min={0}
                          value={s.price}
                          onChange={(e) => update(s.id, { price: Number(e.target.value) || 0 })}
                          className="h-9 w-16 px-2 text-center"
                          aria-label="Cijena (KM)"
                        />
                        KM
                      </span>
                      {(s.gapMin ?? 0) > 0 && <span className="w-full pl-7 text-xs text-mint">djelovanje {s.gapMin} min — radnik slobodan za drugog klijenta</span>}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    setServices([
                      ...services,
                      { id: `own:${Date.now()}`, category: "Ostalo", name: "", durationMin: 30, price: 0, selected: true },
                    ])
                  }
                  className="mt-3 flex items-center gap-1.5 text-sm font-medium text-lacquer hover:underline"
                >
                  <Plus size={15} /> Dodaj svoju uslugu
                </button>
              </section>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-ink-soft">Svaki radnik dobija svoju kolonu i boju u kalendaru. Kasnije ih možete pozvati da imaju svoj nalog.</p>
            <ul className="space-y-2">
              {staff.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3">
                  <Swatch color={staffColors(i)} />
                  <Input
                    value={s.name}
                    onChange={(e) => setStaff(staff.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                    placeholder="Ime radnika"
                    className="h-10 flex-1"
                    autoFocus={i === staff.length - 1 && i > 0}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={s.isMe}
                      onChange={(e) => setStaff(staff.map((x) => ({ ...x, isMe: x.id === s.id ? e.target.checked : e.target.checked ? false : x.isMe })))}
                      className="h-4 w-4 accent-[var(--lacquer)]"
                    />
                    Ovo sam ja
                  </label>
                  {staff.length > 1 && (
                    <button type="button" onClick={() => setStaff(staff.filter((x) => x.id !== s.id))} className="rounded p-1.5 text-ink-faint hover:text-lacquer" aria-label="Ukloni">
                      <X size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setStaff([...staff, { id: String(Date.now()), name: "", isMe: false }])}
              className="flex items-center gap-1.5 text-sm font-medium text-lacquer hover:underline"
            >
              <Plus size={15} /> Dodaj radnika
            </button>
            {!staff.some((s) => s.isMe) && (
              <p className="text-sm text-ink-soft">Ne radite sami u salonu? U redu — kalendar će se otvarati na svim radnicima.</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-ink-soft">Isto za sve radnike na početku. Smjene, pauze i slobodne dane po radniku podesite kasnije u Radnicima.</p>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
              {hours.map((h) => {
                const day = WEEKDAYS[h.weekday - 1];
                const set = (patch: Partial<DayHours>) => setHours(hours.map((x) => (x.weekday === h.weekday ? { ...x, ...patch } : x)));
                return (
                  <li key={h.weekday} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <label className="flex w-32 cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={h.open} onChange={(e) => set({ open: e.target.checked })} className="h-4 w-4 accent-[var(--lacquer)]" />
                      <span className={h.open ? "font-medium" : "text-ink-faint"}>{day.long}</span>
                    </label>
                    {h.open ? (
                      <span className="flex items-center gap-1.5">
                        <input type="time" step={900} value={h.start} onChange={(e) => set({ start: e.target.value })} className="tabular h-9 rounded-md bg-paper px-2 text-sm ring-1 ring-line-strong" aria-label={`${day.long} od`} />
                        <span className="text-ink-faint">–</span>
                        <input type="time" step={900} value={h.end} onChange={(e) => set({ end: e.target.value })} className="tabular h-9 rounded-md bg-paper px-2 text-sm ring-1 ring-line-strong" aria-label={`${day.long} do`} />
                      </span>
                    ) : (
                      <span className="text-sm text-ink-faint">Zatvoreno</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <Summary services={chosen} staff={people} hours={openDays} />
          </div>
        )}
      </div>

      <FormError message={error} />

      <div className="mt-8 flex items-center justify-between gap-3">
        {step === 1 ? (
          <Link href="/app/kalendar" className="text-sm text-ink-soft hover:text-ink">
            Preskoči, uredit ću ručno
          </Link>
        ) : (
          <Button variant="ghost" onClick={() => setStep(((step as number) - 1) as Step)}>
            Nazad
          </Button>
        )}
        {step === 1 && (
          <Button size="lg" disabled={!chosen.length} onClick={() => setStep(2)}>
            Dalje ({chosen.length} usluga)
          </Button>
        )}
        {step === 2 && (
          <Button size="lg" disabled={!people.length} onClick={() => setStep(3)}>
            Dalje
          </Button>
        )}
        {step === 3 && (
          <Button size="lg" disabled={!hoursValid || pending} onClick={finish}>
            {pending ? "Postavljam salon…" : "Završi postavljanje"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Boje kakve će radnici dobiti, redom (isto kao na serveru). */
function staffColors(index: number) {
  const used: string[] = [];
  for (let i = 0; i <= index; i++) used.push(nextFreeSwatch(used));
  return used[index];
}

function Summary({ services, staff, hours }: { services: DraftService[]; staff: DraftStaff[]; hours: DayHours[] }) {
  const totalMin = useMemo(() => services.reduce((s, x) => s + x.durationMin, 0), [services]);
  return (
    <p className="rounded-[var(--radius-chip)] bg-porcelain/70 px-3 py-2.5 text-sm text-ink-soft ring-1 ring-line">
      Dodaje se: <strong className="text-ink">{services.length} usluga</strong> (ukupno {formatDuration(totalMin)} u cjenovniku),{" "}
      <strong className="text-ink">{staff.length} radnika</strong>, radno vrijeme{" "}
      {hours.map((h) => `${WEEKDAYS[h.weekday - 1].short} ${formatClock(toMin(h.start))}–${formatClock(toMin(h.end))}`).join(", ")}.
    </p>
  );
}

function Done({ salonName, bookingUrl, result }: { salonName: string; bookingUrl: string; result: { staff: number; services: number } }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mx-auto max-w-xl px-4 pt-12 pb-16 text-center sm:px-8">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint text-white">
        <Check size={24} />
      </span>
      <h1 className="mt-5 font-display text-4xl leading-tight">{salonName} je spreman</h1>
      <p className="mt-2 text-ink-soft">
        Dodano {result.services} usluga i {result.staff} radnika. Klijenti već mogu zakazivati preko linka.
      </p>
      <div className="mt-8 rounded-[var(--radius-card)] bg-ink p-5 text-left text-porcelain">
        <p className="text-sm text-porcelain/60">Link za zakazivanje — stavite ga u Instagram bio i na Google profil</p>
        <p className="mt-2 text-sm break-all">{bookingUrl}</p>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(bookingUrl);
            setCopied(true);
          }}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-porcelain px-4 text-sm font-medium text-ink"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Kopirano" : "Kopiraj link"}
        </button>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/app/kalendar" size="lg">
          Otvori kalendar
        </ButtonLink>
        <ButtonLink href="/app/radnici/pristup" size="lg" variant="secondary">
          Pozovi radnike
        </ButtonLink>
      </div>
    </div>
  );
}
