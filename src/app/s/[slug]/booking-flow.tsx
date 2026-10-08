"use client";

import { clsx } from "clsx";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Swatch } from "@/components/ui/swatch";
import { formatClock, formatDuration, formatLocalDateLong, formatPrice, MONTHS_GENITIVE, WEEKDAYS } from "@/lib/format";
import { bookPublicAction } from "./actions";

interface Service {
  id: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  priceFrom: boolean;
  staffIds: string[];
}

interface StaffLite {
  id: string;
  name: string;
  title: string | null;
  color: string;
}

type Step = "services" | "staff" | "time" | "details" | "done";
export type Day = { date: string; slots: { startMin: number; staffIds: string[] }[] };

export const WINDOW = 14;

function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function BookingFlow({
  slug,
  today,
  currency,
  services,
  staff,
  emailEnabled,
}: {
  slug: string;
  today: string;
  currency: string;
  services: Service[];
  staff: StaffLite[];
  /** Šalje li se potvrda mailom (tek s vlastitim domenom) — inače polje za email ne nudimo */
  emailEnabled: boolean;
}) {
  const [step, setStep] = useState<Step>("services");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string | "any">("any");
  const [from, setFrom] = useState(today);
  const [loaded, setLoaded] = useState<{ key: string; days: Day[] | null; error: string | null } | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [startMin, setStartMin] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookedStaff, setBookedStaff] = useState<string | null>(null);
  const [manageHref, setManageHref] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const chosen = serviceIds.map((id) => services.find((s) => s.id === id)!).filter(Boolean);
  const duration = chosen.reduce((sum, s, i) => sum + s.durationMin + (i < chosen.length - 1 ? s.bufferMin : 0), 0);
  const price = chosen.reduce((sum, s) => sum + s.priceCents, 0);
  const priceFrom = chosen.some((s) => s.priceFrom);

  // Radnici koji rade sve odabrane usluge
  const eligibleStaff = staff.filter((st) => chosen.every((s) => s.staffIds.includes(st.id)));

  // Termini se učitavaju za trenutni izbor; stari rezultat se ne prikazuje
  const loadKey = step === "time" && serviceIds.length ? `${from}|${staffId}|${serviceIds.join(",")}` : null;
  const days = loaded && loaded.key === loadKey ? loaded.days : null;
  const loadError = loaded && loaded.key === loadKey ? loaded.error : null;

  const groups = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of services) map.set(s.categoryName ?? "Usluge", [...(map.get(s.categoryName ?? "Usluge") ?? []), s]);
    return [...map.entries()];
  }, [services]);

  useEffect(() => {
    if (!loadKey) return;
    const [start, who, ids] = loadKey.split("|");
    const ctrl = new AbortController();
    const p = new URLSearchParams({ from: start, days: String(WINDOW) });
    ids.split(",").forEach((id) => p.append("serviceId", id));
    if (who !== "any") p.set("staffId", who);
    fetch(`/api/public/${slug}/availability?${p}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Greška");
        return body as { days: Day[] };
      })
      .then((d) => {
        setLoaded({ key: loadKey, days: d.days, error: null });
        // Automatski otvori prvi dan sa slobodnim terminom
        setDate((cur) => (cur && d.days.some((x) => x.date === cur && x.slots.length) ? cur : (d.days.find((x) => x.slots.length)?.date ?? null)));
      })
      .catch((e) => e.name !== "AbortError" && setLoaded({ key: loadKey, days: null, error: e.message }));
    return () => ctrl.abort();
  }, [loadKey, slug]);

  const toggleService = (id: string) => {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    setStartMin(null);
  };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!date || startMin === null) return;
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await bookPublicAction(slug, {
        serviceIds,
        staffId: staffId === "any" ? undefined : staffId,
        date,
        startMin,
        name: String(f.get("name")),
        phone: String(f.get("phone")),
        email: String(f.get("email") ?? ""),
        notes: String(f.get("notes") ?? ""),
        website: String(f.get("website") ?? ""),
      });
      if (!res.ok) {
        setError(res.error);
        if (/slobodan|zauzet/i.test(res.error)) {
          setStartMin(null);
          setStep("time");
        }
        return;
      }
      setBookedStaff(res.data.staffId);
      setManageHref(res.data.managePath);
      setStep("done");
    });
  }

  if (services.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] bg-paper p-6 text-ink-soft ring-1 ring-line">
        Online zakazivanje još nije uključeno. Pozovite salon telefonom.
      </p>
    );
  }

  if (step === "done" && date && startMin !== null) {
    const who = staff.find((s) => s.id === bookedStaff);
    return (
      <div className="mx-auto max-w-lg animate-[rise_300ms_ease-out] rounded-[var(--radius-card)] bg-paper p-6 text-center ring-1 ring-line sm:p-10">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint text-white">
          <Check size={24} />
        </span>
        <h2 className="mt-5 font-display text-3xl">Termin je zakazan</h2>
        <p className="mt-2 text-ink-soft">Vidimo se {formatLocalDateLong(date)} u {formatClock(startMin)}.</p>
        <dl className="mt-6 divide-y divide-line rounded-[var(--radius-chip)] text-left ring-1 ring-line">
          <Row label="Usluga" value={chosen.map((s) => s.name).join(" + ")} />
          {who && <Row label="Kod" value={who.name} />}
          <Row label="Trajanje" value={formatDuration(duration)} />
          <Row label="Cijena" value={formatPrice(price, currency, priceFrom)} />
        </dl>
        {manageHref && (
          <div className="mt-6 rounded-[var(--radius-chip)] bg-porcelain px-4 py-3 text-left text-sm">
            <p className="text-ink-soft">Ne možete doći? Otkažite ili pomjerite termin sami — sačuvajte ovaj link:</p>
            <a href={manageHref} className="mt-1 inline-block font-medium text-lacquer underline-offset-4 hover:underline">
              Otkaži ili pomjeri termin →
            </a>
          </div>
        )}
      </div>
    );
  }

  const stepIndex = ["services", "staff", "time", "details"].indexOf(step);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        {/* 1. Usluge */}
        <StepCard
          n={1}
          title="Usluga"
          active={step === "services"}
          done={stepIndex > 0}
          summary={chosen.map((s) => s.name).join(" + ")}
          onEdit={() => setStep("services")}
        >
          <div className="space-y-6">
            {groups.map(([category, rows]) => (
              <section key={category}>
                <h3 className="mb-2 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">{category}</h3>
                <ul className="divide-y divide-line rounded-[var(--radius-chip)] ring-1 ring-line">
                  {rows.map((s) => {
                    const on = serviceIds.includes(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleService(s.id)}
                          className={clsx("flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors", on ? "bg-lacquer-wash/60" : "hover:bg-porcelain")}
                        >
                          <span
                            className={clsx(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] ring-1 transition-colors",
                              on ? "bg-lacquer text-white ring-lacquer" : "bg-paper ring-line-strong",
                            )}
                          >
                            {on && <Check size={14} strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{s.name}</span>
                            <span className="block text-sm text-ink-soft">
                              {formatDuration(s.durationMin)}
                              {s.description && ` · ${s.description}`}
                            </span>
                          </span>
                          <span className="tabular shrink-0 font-medium">{formatPrice(s.priceCents, currency, s.priceFrom)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={!serviceIds.length}
              onClick={() => {
                if (staffId !== "any" && !eligibleStaff.some((s) => s.id === staffId)) setStaffId("any");
                setStep(eligibleStaff.length > 1 ? "staff" : "time");
              }}
            >
              Dalje
            </Button>
          </div>
        </StepCard>

        {/* 2. Radnik */}
        <StepCard
          n={2}
          title="Kod koga"
          active={step === "staff"}
          done={stepIndex > 1}
          summary={staffId === "any" ? "Bilo ko slobodan" : staff.find((s) => s.id === staffId)?.name}
          onEdit={stepIndex > 1 ? () => setStep("staff") : undefined}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <StaffOption
              selected={staffId === "any"}
              onClick={() => {
                setStaffId("any");
                setStartMin(null);
                setStep("time");
              }}
              title="Bilo ko slobodan"
              subtitle="Najviše slobodnih termina"
            />
            {eligibleStaff.map((s) => (
              <StaffOption
                key={s.id}
                color={s.color}
                selected={staffId === s.id}
                onClick={() => {
                  setStaffId(s.id);
                  setStartMin(null);
                  setStep("time");
                }}
                title={s.name}
                subtitle={s.title ?? undefined}
              />
            ))}
          </div>
        </StepCard>

        {/* 3. Termin */}
        <StepCard
          n={3}
          title="Termin"
          active={step === "time"}
          done={stepIndex > 2}
          summary={date && startMin !== null ? `${formatLocalDateLong(date)} u ${formatClock(startMin)}` : undefined}
          onEdit={stepIndex > 2 ? () => setStep("time") : undefined}
        >
          <TimePicker
            today={today}
            from={from}
            onFrom={setFrom}
            days={days}
            error={loadError}
            date={date}
            onDate={(d) => {
              setDate(d);
              setStartMin(null);
            }}
            startMin={startMin}
            onPick={(m) => {
              setStartMin(m);
              setError(null);
              setStep("details");
            }}
          />
        </StepCard>

        {/* 4. Podaci */}
        <StepCard n={4} title="Vaši podaci" active={step === "details"} done={false}>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ime i prezime">
                <Input name="name" autoComplete="name" required minLength={2} autoFocus />
              </Field>
              <Field label="Broj telefona" hint="Salon vas zove samo ako se nešto promijeni.">
                <Input name="phone" type="tel" autoComplete="tel" required placeholder="061 234 567" />
              </Field>
            </div>
            {emailEnabled && (
              <Field label="Email (nije obavezno)" hint="Stiže vam potvrda i link za otkazivanje ili pomjeranje.">
                <Input name="email" type="email" autoComplete="email" />
              </Field>
            )}
            <Field label="Napomena (nije obavezno)">
              <Textarea name="notes" rows={2} placeholder="npr. dužina kose, posebne želje" />
            </Field>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <FormError message={error} />
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
              {pending ? "Zakazujem…" : "Potvrdi termin"}
            </Button>
          </form>
        </StepCard>
      </div>

      {/* Sažetak */}
      <aside className="h-fit lg:sticky lg:top-6">
        <div className="rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line">
          <h2 className="font-display text-xl">Vaš termin</h2>
          {chosen.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Odaberite jednu ili više usluga.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-1.5 text-sm">
                {chosen.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3">
                    <span>{s.name}</span>
                    <span className="tabular text-ink-soft">{formatPrice(s.priceCents, currency, s.priceFrom)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-dashed border-line-strong pt-3 font-medium">
                <span>{formatDuration(duration)}</span>
                <span className="tabular">{formatPrice(price, currency, priceFrom)}</span>
              </div>
              {date && startMin !== null && (
                <p className="mt-3 rounded-lg bg-porcelain px-3 py-2 text-sm first-letter:uppercase">
                  {formatLocalDateLong(date)}, {formatClock(startMin)}–{formatClock(startMin + duration)}
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function StepCard({
  n,
  title,
  active,
  done,
  summary,
  onEdit,
  children,
}: {
  n: number;
  title: string;
  active: boolean;
  done: boolean;
  summary?: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={clsx("rounded-[var(--radius-card)] bg-paper ring-1 transition-shadow", active ? "ring-line-strong shadow-[var(--shadow-lift)]" : "ring-line")}>
      <header className="flex items-center gap-3 px-5 py-4">
        <span
          className={clsx(
            "tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            done ? "bg-ink text-porcelain" : active ? "bg-lacquer text-white" : "bg-porcelain text-ink-faint",
          )}
        >
          {done ? <Check size={14} strokeWidth={3} /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx("block font-display text-lg leading-tight", !active && !done && "text-ink-faint")}>{title}</span>
          {done && summary && <span className="block truncate text-sm text-ink-soft first-letter:uppercase">{summary}</span>}
        </span>
        {done && onEdit && (
          <button type="button" onClick={onEdit} className="text-sm font-medium text-lacquer hover:underline">
            Promijeni
          </button>
        )}
      </header>
      {active && <div className="animate-[rise_220ms_ease-out] px-5 pb-5">{children}</div>}
    </section>
  );
}

function StaffOption({
  selected,
  onClick,
  title,
  subtitle,
  color,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "flex items-center gap-3 rounded-[var(--radius-chip)] px-3.5 py-3 text-left ring-1 transition-colors",
        selected ? "bg-lacquer-wash/60 ring-lacquer" : "ring-line-strong hover:bg-porcelain",
      )}
    >
      {color ? (
        <Swatch color={color} />
      ) : (
        <span className="flex h-9 w-7 items-center justify-center gap-px" aria-hidden>
          {["rubin", "ljubicasta", "kadulja"].map((c) => (
            <Swatch key={c} color={c} size="sm" className="!w-2" />
          ))}
        </span>
      )}
      <span>
        <span className="block font-medium">{title}</span>
        {subtitle && <span className="block text-sm text-ink-soft">{subtitle}</span>}
      </span>
    </button>
  );
}

export function TimePicker({
  today,
  from,
  onFrom,
  days,
  error,
  date,
  onDate,
  startMin,
  onPick,
}: {
  today: string;
  from: string;
  onFrom: (d: string) => void;
  days: Day[] | null;
  error: string | null;
  date: string | null;
  onDate: (d: string) => void;
  startMin: number | null;
  onPick: (m: number) => void;
}) {
  if (error) return <FormError message={error} />;

  const day = days?.find((d) => d.date === date);
  const parts = day
    ? [
        { label: "Prijepodne", slots: day.slots.filter((s) => s.startMin < 12 * 60) },
        { label: "Poslijepodne", slots: day.slots.filter((s) => s.startMin >= 12 * 60 && s.startMin < 17 * 60) },
        { label: "Uveče", slots: day.slots.filter((s) => s.startMin >= 17 * 60) },
      ].filter((p) => p.slots.length)
    : [];

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={from <= today}
          onClick={() => onFrom(addDays(from, -WINDOW))}
          className="rounded-full p-2 text-ink-soft ring-1 ring-line hover:text-ink disabled:opacity-30"
          aria-label="Ranije"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="-my-1 flex flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
          {(days ?? Array.from({ length: WINDOW }, (_, i) => ({ date: addDays(from, i), slots: [] as Day["slots"] }))).map((d) => {
            const [, m, dd] = d.date.split("-").map(Number);
            const wd = new Date(`${d.date}T12:00:00Z`).getUTCDay() || 7;
            const free = d.slots.length > 0;
            const on = d.date === date;
            return (
              <button
                key={d.date}
                type="button"
                disabled={!days || !free}
                onClick={() => onDate(d.date)}
                aria-pressed={on}
                aria-label={`${formatLocalDateLong(d.date)}${free ? "" : ", nema termina"}`}
                className={clsx(
                  "flex w-12 shrink-0 flex-col items-center rounded-[var(--radius-chip)] py-2 ring-1 transition-colors",
                  on ? "bg-ink text-porcelain ring-ink" : free ? "bg-paper ring-line-strong hover:ring-ink-faint" : "bg-porcelain/60 text-ink-faint ring-transparent",
                  !days && "animate-pulse",
                )}
              >
                <span className="text-[0.6875rem] font-medium uppercase">{WEEKDAYS[wd - 1].short}</span>
                <span className="tabular font-display text-lg leading-tight">{dd}</span>
                <span className={clsx("mt-0.5 h-1 w-1 rounded-full", free ? (on ? "bg-porcelain" : "bg-mint") : "bg-transparent")} />
                <span className="sr-only">{MONTHS_GENITIVE[m - 1]}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onFrom(addDays(from, WINDOW))}
          className="rounded-full p-2 text-ink-soft ring-1 ring-line hover:text-ink"
          aria-label="Kasnije"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-5 min-h-24">
        {days && !days.some((d) => d.slots.length) && (
          <p className="text-ink-soft">Nema slobodnih termina u ovom periodu. Pogledajte sljedeće sedmice ili odaberite drugog radnika.</p>
        )}
        {parts.map((p) => (
          <div key={p.label} className="mb-4">
            <h4 className="mb-2 text-sm text-ink-soft">{p.label}</h4>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {p.slots.map((s) => (
                <button
                  key={s.startMin}
                  type="button"
                  onClick={() => onPick(s.startMin)}
                  className={clsx(
                    "tabular h-10 rounded-[var(--radius-chip)] text-[0.9375rem] font-medium ring-1 transition-colors",
                    s.startMin === startMin ? "bg-lacquer text-white ring-lacquer" : "bg-paper ring-line-strong hover:bg-lacquer-wash hover:ring-lacquer/40",
                  )}
                >
                  {formatClock(s.startMin)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
