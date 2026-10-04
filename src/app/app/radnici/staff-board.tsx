"use client";

import { clsx } from "clsx";
import { Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, FormError, Input, Toggle } from "@/components/ui/field";
import { Swatch } from "@/components/ui/swatch";
import { formatClock, formatLocalDateLong, plural, WEEKDAYS } from "@/lib/format";
import { nextFreeSwatch, swatch, SWATCHES } from "@/lib/swatches";
import { addTimeOffAction, removeTimeOffAction, saveStaffAction, setStaffActiveAction } from "./actions";

/** week: 0 = sedmica A (ili jedina), 1 = sedmica B */
type Shift = { weekday: number; week: number; startMin: number; endMin: number };

export interface StaffRow {
  id: string;
  name: string;
  title: string | null;
  color: string;
  phone: string | null;
  bookableOnline: boolean;
  active: boolean;
  serviceIds: string[];
  hours: Shift[];
  rotationWeeks: number;
  rotationAnchor: string | null;
}

interface TimeOffRow {
  id: string;
  staffId: string;
  fromDate: string;
  toDate: string;
  startMin: number;
  endMin: number;
  reason: string | null;
}

interface ServiceLite {
  id: string;
  name: string;
  categoryName: string | null;
}

const DEFAULT_HOURS: Shift[] = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, week: 0, startMin: 9 * 60, endMin: 17 * 60 })),
  { weekday: 6, week: 0, startMin: 9 * 60, endMin: 14 * 60 },
];

export function StaffBoard({
  canEdit,
  staff,
  services,
  timeOff,
}: {
  canEdit: boolean;
  staff: StaffRow[];
  services: ServiceLite[];
  timeOff: TimeOffRow[];
}) {
  const [editing, setEditing] = useState<StaffRow | "new" | null>(null);
  const active = staff.filter((s) => s.active);
  const inactive = staff.filter((s) => !s.active);

  return (
    <>
      <PageHeader
        title="Radnici"
        description="Ko radi, kada i koje usluge. Svaki radnik ima svoju boju u kalendaru."
        actions={
          canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={18} /> Novi radnik
            </Button>
          )
        }
      />

      <div className="px-4 pb-10 sm:px-8">
        {active.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="font-display text-2xl">Još nema radnika</p>
            <p className="mx-auto mt-2 max-w-sm text-ink-soft">
              Dodajte sebe i svoje radnike. Bez radnog vremena nema ni slobodnih termina.
            </p>
            {canEdit && (
              <Button className="mt-5" onClick={() => setEditing("new")}>
                <Plus size={18} /> Dodaj radnika
              </Button>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((s) => {
              const absences = timeOff.filter((t) => t.staffId === s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => canEdit && setEditing(s)}
                    disabled={!canEdit}
                    className="group flex h-full w-full flex-col rounded-[var(--radius-card)] bg-paper p-4 text-left ring-1 ring-line transition-shadow enabled:hover:shadow-[var(--shadow-lift)] disabled:cursor-default"
                  >
                    <span className="flex items-start gap-3.5">
                      <Swatch color={s.color} size="lg" />
                      <span className="min-w-0 pt-1">
                        <span className="block font-display text-xl leading-tight">{s.name}</span>
                        <span className="block truncate text-sm text-ink-soft">{s.title || swatch(s.color).name}</span>
                        <span className="mt-1 block text-sm text-ink-faint">
                          {s.serviceIds.length} {plural(s.serviceIds.length, "usluga", "usluge", "usluga")}
                          {!s.bookableOnline && " · samo recepcija"}
                        </span>
                      </span>
                    </span>
                    {s.rotationWeeks === 2 ? (
                      <span className="mt-4 block space-y-2">
                        {[0, 1].map((w) => (
                          <span key={w} className="flex items-start gap-2">
                            <span className="w-3 pt-3 text-xs font-semibold text-ink-faint">{w === 0 ? "A" : "B"}</span>
                            <WeekRibbon hours={s.hours.filter((h) => h.week === w)} color={s.color} className="flex-1" />
                          </span>
                        ))}
                      </span>
                    ) : (
                      <WeekRibbon hours={s.hours.filter((h) => h.week === 0)} color={s.color} className="mt-4" />
                    )}
                    {absences[0] && (
                      <span className="mt-3 block text-sm text-amber">
                        Odsutan/na: {formatLocalDateLong(absences[0].fromDate)}
                        {absences[0].toDate !== absences[0].fromDate && ` – ${formatLocalDateLong(absences[0].toDate)}`}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && inactive.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm text-ink-soft hover:text-ink">Bivši radnici ({inactive.length})</summary>
            <ul className="mt-2 divide-y divide-line rounded-[var(--radius-card)] bg-paper/60 ring-1 ring-line">
              {inactive.map((s) => (
                <InactiveRow key={s.id} staff={s} />
              ))}
            </ul>
          </details>
        )}
      </div>

      <StaffSheet
        key={editing === "new" ? "new" : (editing?.id ?? "none")}
        staff={editing}
        usedColors={active.map((s) => s.color)}
        services={services}
        timeOff={editing && editing !== "new" ? timeOff.filter((t) => t.staffId === editing.id) : []}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

/** Sedmica u malom: traka po danu, popunjena u satima rada (07–21 h). */
function WeekRibbon({ hours, color, className }: { hours: Shift[]; color: string; className?: string }) {
  const from = 7 * 60;
  const span = 14 * 60;
  const hex = swatch(color).hex;
  return (
    <span className={clsx("grid grid-cols-7 gap-1", className)}>
      {WEEKDAYS.map((d) => {
        const shifts = hours.filter((h) => h.weekday === d.iso);
        const label = shifts.map((s) => `${formatClock(s.startMin)}–${formatClock(s.endMin)}`).join(", ");
        return (
          <span key={d.iso} className="text-center" title={`${d.long}: ${label || "ne radi"}`}>
            <span className="relative block h-12 overflow-hidden rounded-[4px] bg-porcelain ring-1 ring-line ring-inset">
              {shifts.map((s, i) => (
                <span
                  key={i}
                  className="absolute inset-x-[3px] rounded-[2px]"
                  style={{
                    top: `${((Math.max(s.startMin, from) - from) / span) * 100}%`,
                    height: `${((Math.min(s.endMin, from + span) - Math.max(s.startMin, from)) / span) * 100}%`,
                    background: hex,
                  }}
                />
              ))}
            </span>
            <span className={clsx("mt-1 block text-[0.6875rem]", shifts.length ? "text-ink-soft" : "text-ink-faint")}>
              {d.short}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function InactiveRow({ staff }: { staff: StaffRow }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between px-4 py-3 text-ink-soft">
      <span className="flex items-center gap-2">
        <Swatch color={staff.color} size="sm" /> {staff.name}
      </span>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => void (await setStaffActiveAction(staff.id, true)))}>
        Vrati
      </Button>
    </li>
  );
}

function StaffSheet({
  staff,
  usedColors,
  services,
  timeOff,
  onClose,
}: {
  staff: StaffRow | "new" | null;
  usedColors: string[];
  services: ServiceLite[];
  timeOff: TimeOffRow[];
  onClose: () => void;
}) {
  const existing = staff && staff !== "new" ? staff : null;
  const [color, setColor] = useState(existing?.color ?? nextFreeSwatch(usedColors));
  const [hours, setHours] = useState<Shift[]>(existing?.hours ?? DEFAULT_HOURS);
  const [rotationWeeks, setRotationWeeks] = useState<1 | 2>(existing?.rotationWeeks === 2 ? 2 : 1);
  const [rotationAnchor, setRotationAnchor] = useState<string>(existing?.rotationAnchor ?? thisMonday());
  const [editWeek, setEditWeek] = useState<0 | 1>(0);
  const [serviceIds, setServiceIds] = useState<string[]>(existing?.serviceIds ?? services.map((s) => s.id));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveStaffAction(existing?.id ?? null, {
        name: String(f.get("name")),
        title: String(f.get("title") ?? ""),
        phone: String(f.get("phone") ?? ""),
        color,
        bookableOnline: f.get("bookableOnline") === "on",
        serviceIds,
        hours,
        rotationWeeks,
        rotationAnchor: rotationWeeks === 2 ? rotationAnchor : null,
      });
      if (!res.ok) return setError(res.error);
      onClose();
    });
  }

  function deactivate() {
    if (!existing) return;
    start(async () => {
      const res = await setStaffActiveAction(existing.id, false);
      if (!res.ok) return setError(res.error);
      onClose();
    });
  }

  return (
    <Sheet
      wide
      open={staff !== null}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? existing.name : "Novi radnik"}
      footer={
        <div className="flex items-center justify-between gap-3">
          {existing ? (
            <Button variant="ghost" onClick={deactivate} disabled={pending}>
              Više ne radi u salonu
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" form="staff-form" disabled={pending}>
            {pending ? "Spremam…" : existing ? "Spremi promjene" : "Dodaj radnika"}
          </Button>
        </div>
      }
    >
      <form id="staff-form" onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ime">
            <Input name="name" defaultValue={existing?.name} required autoFocus={!existing} />
          </Field>
          <Field label="Zvanje (nije obavezno)">
            <Input name="title" defaultValue={existing?.title ?? ""} placeholder="npr. Frizerka" />
          </Field>
        </div>
        <Field label="Telefon (nije obavezno)" hint="Za buduće obavijesti o novim terminima.">
          <Input name="phone" type="tel" defaultValue={existing?.phone ?? ""} />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            Boja u kalendaru — <span className="text-ink-soft">{swatch(color).tone} {swatch(color).name}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setColor(s.key)}
                aria-pressed={color === s.key}
                aria-label={`${s.tone} ${s.name}`}
                className={clsx(
                  "rounded-t-[45%] rounded-b-[5px] p-0.5 transition-transform",
                  color === s.key ? "-translate-y-1 ring-2 ring-ink" : "hover:-translate-y-0.5",
                )}
              >
                <Swatch color={s.key} />
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3">
          <Toggle
            checked={rotationWeeks === 2}
            onChange={(e) => {
              const on = e.target.checked;
              setRotationWeeks(on ? 2 : 1);
              setEditWeek(0);
              // Prvi put: sedmica B kreće kao kopija sedmice A
              if (on && !hours.some((h) => h.week === 1)) {
                setHours([...hours.filter((h) => h.week === 0), ...hours.filter((h) => h.week === 0).map((h) => ({ ...h, week: 1 }))]);
              }
            }}
            label="Smjene se izmjenjuju svake 2 sedmice"
            description="Npr. jednu sedmicu jutarnja, drugu popodnevna smjena."
          />
          {rotationWeeks === 2 && (
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-chip)] bg-porcelain/70 p-3">
              <div className="flex gap-1 rounded-full bg-paper p-1 text-sm ring-1 ring-line">
                {([0, 1] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setEditWeek(w)}
                    aria-pressed={editWeek === w}
                    className={clsx("rounded-full px-3 py-1 font-medium", editWeek === w ? "bg-ink text-porcelain" : "text-ink-soft")}
                  >
                    Sedmica {w === 0 ? "A" : "B"}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Sedmica A je sedmica od
                <input
                  type="date"
                  value={rotationAnchor}
                  onChange={(e) => e.target.value && setRotationAnchor(e.target.value)}
                  className="h-8 rounded-md bg-paper px-2 text-sm text-ink ring-1 ring-line-strong"
                />
              </label>
              <span className="text-sm text-ink-soft">
                Ove sedmice važi: <strong className="text-ink">sedmica {currentRotationWeek(rotationAnchor) === 0 ? "A" : "B"}</strong>
              </span>
            </div>
          )}
          <ScheduleEditor hours={hours} week={rotationWeeks === 2 ? editWeek : 0} onChange={setHours} />
        </div>

        <fieldset>
          <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
            Usluge
            {services.length > 0 && (
              <button
                type="button"
                className="text-sm font-normal text-lacquer hover:underline"
                onClick={() => setServiceIds(serviceIds.length === services.length ? [] : services.map((s) => s.id))}
              >
                {serviceIds.length === services.length ? "Poništi sve" : "Označi sve"}
              </button>
            )}
          </legend>
          {services.length === 0 ? (
            <p className="text-sm text-ink-soft">Usluge dodajete na stranici Usluge.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => {
                const on = serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setServiceIds(on ? serviceIds.filter((x) => x !== s.id) : [...serviceIds, s.id])}
                    className={clsx(
                      "rounded-full px-3 py-1.5 text-sm ring-1 transition-colors",
                      on ? "bg-ink text-porcelain ring-ink" : "bg-paper text-ink-soft ring-line-strong hover:text-ink",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <Toggle
          name="bookableOnline"
          defaultChecked={existing?.bookableOnline ?? true}
          label="Klijenti ga/je mogu birati online"
          description="Isključite ako termine kod ovog radnika upisuje samo recepcija."
        />

        <FormError message={error} />
      </form>

      {existing && <TimeOffSection staffId={existing.id} items={timeOff} />}
    </Sheet>
  );
}

const toTime = (m: number) => formatClock(m);
const fromTime = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
};

function thisMonday() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Koja sedmica (A=0, B=1) važi ove sedmice, za datu sedmicu A. */
function currentRotationWeek(anchor: string) {
  const monday = (iso: string) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() || 7) + 1);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const weeks = Math.round((monday(thisMonday()) - monday(anchor)) / (7 * 86_400_000));
  return ((weeks % 2) + 2) % 2;
}

function ScheduleEditor({ hours, week, onChange }: { hours: Shift[]; week: number; onChange: (h: Shift[]) => void }) {
  const byDay = useMemo(
    () =>
      WEEKDAYS.map((d) => ({
        ...d,
        shifts: hours.filter((h) => h.weekday === d.iso && h.week === week).sort((a, b) => a.startMin - b.startMin),
      })),
    [hours, week],
  );

  const setDay = (iso: number, shifts: Shift[]) =>
    onChange([...hours.filter((h) => !(h.weekday === iso && h.week === week)), ...shifts.map((s) => ({ ...s, week }))]);

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Radno vrijeme</legend>
      <div className="divide-y divide-line rounded-[var(--radius-chip)] ring-1 ring-line">
        {byDay.map((d) => {
          const working = d.shifts.length > 0;
          return (
            <div key={d.iso} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
              <label className="flex w-28 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={working}
                  onChange={(e) =>
                    setDay(d.iso, e.target.checked ? [{ weekday: d.iso, week, startMin: 9 * 60, endMin: 17 * 60 }] : [])
                  }
                  className="h-4 w-4 accent-[var(--lacquer)]"
                />
                <span className={working ? "font-medium" : "text-ink-faint"}>{d.long}</span>
              </label>
              {working ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {d.shifts.map((s, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="mr-1 text-xs text-ink-faint">pauza</span>}
                      <input
                        type="time"
                        step={900}
                        value={toTime(s.startMin)}
                        onChange={(e) =>
                          setDay(d.iso, d.shifts.map((x, j) => (j === i ? { ...x, startMin: fromTime(e.target.value) } : x)))
                        }
                        className="tabular h-8 rounded-md bg-paper px-1.5 text-sm ring-1 ring-line-strong"
                        aria-label={`${d.long} početak`}
                      />
                      <span className="text-ink-faint">–</span>
                      <input
                        type="time"
                        step={900}
                        value={toTime(s.endMin)}
                        onChange={(e) =>
                          setDay(d.iso, d.shifts.map((x, j) => (j === i ? { ...x, endMin: fromTime(e.target.value) } : x)))
                        }
                        className="tabular h-8 rounded-md bg-paper px-1.5 text-sm ring-1 ring-line-strong"
                        aria-label={`${d.long} kraj`}
                      />
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => setDay(d.iso, d.shifts.filter((_, j) => j !== i))}
                          className="rounded p-1 text-ink-faint hover:text-lacquer"
                          aria-label="Ukloni pauzu"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </span>
                  ))}
                  {d.shifts.length === 1 && (
                    <button
                      type="button"
                      className="text-xs text-ink-soft hover:text-lacquer"
                      onClick={() => {
                        // Podijeli smjenu: pauza od sat vremena na sredini
                        const s = d.shifts[0];
                        const mid = Math.round((s.startMin + s.endMin) / 2 / 30) * 30;
                        setDay(d.iso, [
                          { ...s, endMin: mid - 30 },
                          { ...s, startMin: mid + 30 },
                        ]);
                      }}
                    >
                      + pauza
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-sm text-ink-faint">Ne radi</span>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function TimeOffSection({ staffId, items }: { staffId: string; items: TimeOffRow[] }) {
  const [allDay, setAllDay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const fromDate = String(f.get("fromDate"));
    start(async () => {
      const res = await addTimeOffAction({
        staffId,
        fromDate,
        toDate: allDay ? String(f.get("toDate") || fromDate) : fromDate,
        startMin: allDay ? null : fromTime(String(f.get("startTime"))),
        endMin: allDay ? null : fromTime(String(f.get("endTime"))),
        reason: String(f.get("reason") ?? ""),
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      form.reset();
    });
  }

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h3 className="font-display text-xl">Odsustva</h3>
      <p className="mt-1 text-sm text-ink-soft">Godišnji, bolovanje ili blokirano vrijeme — ti termini se ne nude klijentima.</p>

      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-[var(--radius-chip)] ring-1 ring-line">
          {items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span>
                <span className="font-medium">
                  {formatLocalDateLong(t.fromDate)}
                  {t.toDate !== t.fromDate && ` – ${formatLocalDateLong(t.toDate)}`}
                </span>
                {!(t.startMin === 0 && t.endMin === 0) && (
                  <span className="tabular text-ink-soft"> · {formatClock(t.startMin)}–{formatClock(t.endMin)}</span>
                )}
                {t.reason && <span className="block text-ink-soft">{t.reason}</span>}
              </span>
              <button
                type="button"
                className="rounded p-1.5 text-ink-faint hover:text-lacquer"
                aria-label="Ukloni odsustvo"
                onClick={() => start(async () => void (await removeTimeOffAction(t.id)))}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-[var(--radius-chip)] bg-porcelain/70 p-3">
        <div className="flex gap-1 rounded-full bg-paper p-1 ring-1 ring-line text-sm w-fit">
          {[
            [true, "Cijeli dan"],
            [false, "Dio dana"],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setAllDay(value as boolean)}
              className={clsx("rounded-full px-3 py-1", allDay === value ? "bg-ink text-porcelain" : "text-ink-soft")}
            >
              {label as string}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={allDay ? "Od" : "Datum"}>
            <Input name="fromDate" type="date" min={today} required className="h-10" />
          </Field>
          {allDay ? (
            <Field label="Do (uključivo)">
              <Input name="toDate" type="date" min={today} className="h-10" />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Od">
                <Input name="startTime" type="time" step={900} required defaultValue="12:00" className="h-10 px-2" />
              </Field>
              <Field label="Do">
                <Input name="endTime" type="time" step={900} required defaultValue="14:00" className="h-10 px-2" />
              </Field>
            </div>
          )}
        </div>
        <Input name="reason" placeholder="Razlog (nije obavezno)" className="h-10" />
        <FormError message={error} />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          Dodaj odsustvo
        </Button>
      </form>
    </section>
  );
}
