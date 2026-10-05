"use client";

import { clsx } from "clsx";
import { AlertTriangle, ChevronLeft, ChevronRight, MessagesSquare, Plus, Rows3, Rows4, Clock3 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Swatch } from "@/components/ui/swatch";
import { formatClock, formatLocalDateLong, formatPrice, MONTHS_GENITIVE, plural, WEEKDAYS } from "@/lib/format";
import { AgendaList } from "./agenda-list";
import { AppointmentSheet } from "./appointment-sheet";
import { moveAppointmentAction } from "./actions";
import { blockTone, categoryColors, STATUS_TONE } from "./colors";
import { NewAppointmentSheet, type Draft } from "./new-appointment-sheet";
import { TimeGrid, type GridColumn } from "./time-grid";
import { toBlocks, type CalBlock, type CalendarData, type ColorMode, type Density, type View } from "./types";

const HOUR_PX: Record<Density, number> = { udobno: 96, zbijeno: 60 };

function shiftDate(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function CalendarShell({ data, viewExplicit }: { data: CalendarData; viewExplicit: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CalBlock | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>(data.colorMode);
  const [density, setDensity] = useState<Density>(data.density);
  const [toast, setToast] = useState<string | null>(null);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  const isWeek = data.view === "sedmica";
  const day = data.date;
  const blocks = useMemo(() => toBlocks(data.items).filter((b) => b.status !== "cancelled"), [data.items]);
  const conflictKeys = useMemo(() => new Set(data.conflictKeys), [data.conflictKeys]);
  const staffById = useMemo(() => new Map(data.staff.map((s) => [s.id, s])), [data.staff]);
  const dayOf = (staffId: string, date: string) => data.staffDays.find((d) => d.staffId === staffId && d.date === date);

  // Boje
  const categoryOfService = useMemo(() => new Map(data.services.map((s) => [s.id, s.categoryName])), [data.services]);
  const catColors = useMemo(() => categoryColors(data.services.map((s) => s.categoryName)), [data.services]);
  const toneFor = (b: CalBlock) =>
    blockTone(b, colorMode, {
      staffColor: staffById.get(b.staffId)?.color ?? "rubin",
      categoryOf: (id) => categoryOfService.get(id) ?? null,
      categoryColor: catColors,
    });

  // Filter radnika (dan i lista)
  const visibleStaff = useMemo(() => {
    if (data.staffFilter === "svi") return data.staff;
    if (data.staffFilter !== "rade") {
      const ids = new Set(data.staffFilter.split(","));
      const picked = data.staff.filter((s) => ids.has(s.id));
      if (picked.length) return picked;
    }
    return data.staff.filter((s) => (dayOf(s.id, day)?.shifts.length ?? 0) > 0 || blocks.some((b) => b.staffId === s.id && b.date === day));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.staffFilter, data.staff, data.staffDays, blocks, day]);

  const weekStaff = data.staff.find((s) => s.id === data.weekStaffId) ?? data.staff[0];

  const columns: GridColumn[] = isWeek
    ? data.days.map((date, i) => ({
        key: date,
        date,
        staffId: weekStaff?.id ?? "",
        isToday: date === data.today,
        day: weekStaff ? dayOf(weekStaff.id, date) : undefined,
        blocks: blocks.filter((b) => b.staffId === weekStaff?.id && b.date === date),
        header: <DayHeader date={date} weekdayIndex={i} isToday={date === data.today} shifts={weekStaff ? dayOf(weekStaff.id, date) : undefined} />,
      }))
    : visibleStaff.map((s) => ({
        key: s.id,
        date: day,
        staffId: s.id,
        isToday: day === data.today,
        day: dayOf(s.id, day),
        blocks: blocks.filter((b) => b.staffId === s.id && b.date === day),
        header: <StaffHeader name={s.name} color={s.color} day={dayOf(s.id, day)} />,
      }));

  // Vidljivi sati: od najranije smjene do najkasnije (+ termini van smjene)
  const [dayStart, dayEnd] = useMemo(() => {
    const starts = columns.flatMap((c) => [...(c.day?.shifts.map((s) => s.startMin) ?? []), ...c.blocks.map((b) => b.startMin)]);
    const ends = columns.flatMap((c) => [...(c.day?.shifts.map((s) => s.endMin) ?? []), ...c.blocks.map((b) => b.blockedMin)]);
    const start = starts.length ? Math.floor(Math.min(...starts) / 60) * 60 : 8 * 60;
    const end = ends.length ? Math.ceil(Math.max(...ends) / 60) * 60 : 20 * 60;
    return [Math.max(0, Math.min(start, 9 * 60)), Math.min(24 * 60, Math.max(end, 17 * 60))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, visibleStaff, weekStaff]);

  const hourPx = HOUR_PX[density];
  const showsToday = data.days.includes(data.today);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = showsToday ? data.nowMin : dayStart;
    el.scrollTop = Math.max(0, (target - dayStart) * (hourPx / 60) - 120);
  }, [data.date, data.view, showsToday, data.nowMin, dayStart, hourPx]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function onMove(b: CalBlock, col: GridColumn, startMin: number) {
    const res = await moveAppointmentAction({
      appointmentId: b.appointmentId,
      fromStaffId: b.staffId,
      toStaffId: col.staffId,
      date: col.date,
      startMin,
    });
    if (!res.ok) {
      setToast(res.error);
      return false;
    }
    const who = staffById.get(col.staffId)?.name;
    setToast(`Pomjereno: ${b.client?.name ?? "termin"} → ${formatClock(startMin)}${col.staffId !== b.staffId && who ? `, kod: ${who}` : ""}`);
    return true;
  }

  // Statistika za prikazani dan/sedmicu
  const stats = useMemo(() => {
    // Statistika prati ono što je na ekranu (npr. samo "Moji termini")
    const shown = isWeek
      ? blocks.filter((b) => b.staffId === weekStaff?.id)
      : blocks.filter((b) => b.date === day && visibleStaff.some((v) => v.id === b.staffId));
    const visits = new Set(shown.map((b) => b.appointmentId)).size;
    const revenue = shown.filter((b) => b.status !== "no_show").reduce((sum, b) => sum + b.services.reduce((s, x) => s + x.priceCents, 0), 0);
    const viaChannels = new Set(shown.filter((b) => b.source !== "dashboard").map((b) => b.appointmentId)).size;
    return { visits, revenue, viaChannels };
  }, [blocks, isWeek, weekStaff, day, visibleStaff]);

  const needsSetup = data.staff.length === 0 || data.services.length === 0;
  const step = isWeek ? 7 : 1;
  const title = isWeek ? weekTitle(data.days) : formatLocalDateLong(day);
  const subtitle = isWeek ? `Sedmica · ${weekStaff?.name ?? ""}` : day === data.today ? "Danas" : day < data.today ? "Prošli dan" : "Raspored";

  const view: View = data.view;
  /** Bez izričitog izbora: na telefonu lista, na većem ekranu mreža */
  const autoList = !viewExplicit && view === "dan";

  const newDraft = () =>
    setDraft({
      staffId: (isWeek ? weekStaff?.id : visibleStaff[0]?.id) ?? data.staff[0].id,
      date: isWeek ? (data.days.includes(data.today) ? data.today : data.days[0]) : day,
      startMin: showsToday ? Math.ceil(data.nowMin / 15) * 15 : dayStart,
    });

  return (
    <div className="flex flex-col md:h-[calc(100dvh-4.25rem)] lg:h-dvh">
      <header className="shrink-0 space-y-3 px-4 pt-5 pb-3 sm:px-8 sm:pt-7">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-sm text-ink-soft">{subtitle}</p>
            <h1 className="font-display text-[1.75rem] leading-tight first-letter:uppercase sm:text-4xl">{title}</h1>
            {!needsSetup && (
              <p className="tabular mt-1 text-sm text-ink-soft">
                {stats.visits} {plural(stats.visits, "termin", "termina", "termina")}
                {data.canSeeRevenue && <> · {formatPrice(stats.revenue, data.currency)}</>}
                {stats.viaChannels > 0 && <> · {stats.viaChannels} zakazano bez recepcije</>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={autoList ? "dan" : view}
              options={[
                ["dan", "Dan"],
                ["sedmica", "Sedmica"],
                ["lista", "Lista"],
              ]}
              onChange={(v) => router.push(href({ v }))}
            />
            <div className="flex items-center rounded-full bg-paper ring-1 ring-line-strong">
              <Link href={href({ d: shiftDate(day, -step) })} className="rounded-l-full p-2.5 text-ink-soft hover:text-ink" aria-label="Ranije">
                <ChevronLeft size={18} />
              </Link>
              <label className="relative cursor-pointer border-x border-line px-3 py-2 text-sm font-medium">
                {showsToday ? "Danas" : "Datum"}
                <input
                  type="date"
                  value={day}
                  onChange={(e) => e.target.value && router.push(href({ d: e.target.value }))}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Odaberi datum"
                />
              </label>
              <Link href={href({ d: shiftDate(day, step) })} className="rounded-r-full p-2.5 text-ink-soft hover:text-ink" aria-label="Kasnije">
                <ChevronRight size={18} />
              </Link>
            </div>
            {!showsToday && (
              <Link href={href({ d: null })} className="hidden rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink sm:block">
                Danas
              </Link>
            )}
            {!needsSetup && (
              <Button
                onClick={newDraft}
                aria-label="Novi termin"
                className="max-sm:fixed max-sm:right-4 max-sm:bottom-20 max-sm:z-30 max-sm:h-14 max-sm:w-14 max-sm:shadow-[var(--shadow-pop)]"
              >
                <Plus size={20} /> <span className="hidden sm:inline">Novi termin</span>
              </Button>
            )}
          </div>
        </div>

        {!needsSetup && <Alerts alerts={data.alerts} today={data.today} />}

        {!needsSetup && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {isWeek ? (
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
                {data.staff.map((s) => (
                  <Chip key={s.id} active={s.id === weekStaff?.id} href={href({ s: s.id })} color={s.color} label={s.name} />
                ))}
              </div>
            ) : (
              <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
                {data.myStaffId && (
                  <Chip active={data.staffFilter === data.myStaffId} href={href({ r: data.myStaffId })} label="Moji termini" />
                )}
                <Chip active={data.staffFilter === "rade"} href={href({ r: "rade" })} label="Rade danas" />
                <Chip active={data.staffFilter === "svi"} href={href({ r: "svi" })} label="Svi" />
                <span className="mx-1 h-5 w-px bg-line-strong" />
                {data.staff.map((s) => {
                  const on = visibleStaff.some((v) => v.id === s.id);
                  const next = on ? visibleStaff.filter((v) => v.id !== s.id) : [...visibleStaff, s];
                  return (
                    <Chip
                      key={s.id}
                      active={on && data.staffFilter !== "rade" && data.staffFilter !== "svi" && data.staffFilter !== data.myStaffId}
                      dim={!on}
                      href={href({ r: next.length ? next.map((v) => v.id).join(",") : null })}
                      color={s.color}
                      label={s.name}
                    />
                  );
                })}
              </div>
            )}
            <div className="hidden items-center gap-2 sm:flex">
              <Legend mode={colorMode} catColors={catColors} />
              <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                Boja
                <select
                  value={colorMode}
                  onChange={(e) => {
                    const v = e.target.value as ColorMode;
                    setColorMode(v);
                    setCookie("cal_color", v);
                  }}
                  className="h-8 rounded-full bg-paper px-2.5 text-sm text-ink ring-1 ring-line-strong focus:ring-2 focus:ring-lacquer focus:outline-none"
                >
                  <option value="status">po statusu</option>
                  <option value="usluga">po usluzi</option>
                  <option value="radnik">po radniku</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  const v = density === "udobno" ? "zbijeno" : "udobno";
                  setDensity(v);
                  setCookie("cal_density", v);
                }}
                className="hidden rounded-full p-2 text-ink-soft ring-1 ring-line-strong hover:text-ink md:block"
                title={density === "udobno" ? "Zbijeniji prikaz" : "Prostraniji prikaz"}
                aria-label="Promijeni gustinu prikaza"
              >
                {density === "udobno" ? <Rows4 size={16} /> : <Rows3 size={16} />}
              </button>
            </div>
          </div>
        )}
      </header>

      {needsSetup ? (
        <SetupChecklist hasServices={data.services.length > 0} hasStaff={data.staff.length > 0} />
      ) : (
        <>
          {(view === "lista" || autoList) && (
            <div className={clsx("pt-1 md:min-h-0 md:flex-1 md:overflow-y-auto", autoList && "md:hidden")}>
              <AgendaList
                blocks={blocks.filter((b) => b.date === day && visibleStaff.some((s) => s.id === b.staffId))}
                staff={data.staff}
                staffDays={data.staffDays.filter((d) => d.date === day && visibleStaff.some((s) => s.id === d.staffId))}
                conflictKeys={conflictKeys}
                toneFor={toneFor}
                onSelect={setSelected}
                nowMin={data.nowMin}
                isToday={day === data.today}
              />
            </div>
          )}
          {view !== "lista" && (
            <div
              ref={scrollRef}
              className={clsx("relative h-[75dvh] min-h-0 overflow-auto border-t border-line bg-paper/40 md:h-auto md:flex-1", autoList && "hidden md:block")}
            >
              {columns.length === 0 ? (
                <p className="px-8 py-10 text-ink-soft">Niko ne radi ovog dana. Odaberite „Svi“ da vidite sve radnike.</p>
              ) : (
                <TimeGrid
                  columns={columns}
                  dayStart={dayStart}
                  dayEnd={dayEnd}
                  hourPx={hourPx}
                  nowMin={data.nowMin}
                  conflictKeys={conflictKeys}
                  toneFor={toneFor}
                  onSelect={setSelected}
                  onEmptyClick={(col, startMin) => setDraft({ staffId: col.staffId, date: col.date, startMin })}
                  onMove={onMove}
                  minColWidth={isWeek ? "8.5rem" : "10rem"}
                />
              )}
            </div>
          )}
        </>
      )}

      {toast && (
        <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-[rise_200ms_ease-out] rounded-full bg-ink px-4 py-2.5 text-sm text-porcelain shadow-[var(--shadow-pop)] lg:bottom-6">
          {toast}
        </div>
      )}

      <AppointmentSheet block={selected} staff={data.staff} currency={data.currency} showPrices={data.canSeeRevenue} onClose={() => setSelected(null)} />
      <NewAppointmentSheet
        key={draft ? `${draft.staffId}-${draft.date}-${draft.startMin}` : "none"}
        draft={draft}
        staff={data.staff}
        services={data.services}
        currency={data.currency}
        onClose={() => setDraft(null)}
      />
    </div>
  );
}

function weekTitle(days: string[]) {
  const [, m1, d1] = days[0].split("-").map(Number);
  const [, m2, d2] = days[6].split("-").map(Number);
  return m1 === m2 ? `${d1}.–${d2}. ${MONTHS_GENITIVE[m2 - 1]}` : `${d1}. ${MONTHS_GENITIVE[m1 - 1]} – ${d2}. ${MONTHS_GENITIVE[m2 - 1]}`;
}

function StaffHeader({ name, color, day }: { name: string; color: string; day: CalendarData["staffDays"][number] | undefined }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <Swatch color={color} />
      <span className="min-w-0">
        <span className="block truncate font-medium leading-tight">{name}</span>
        <span className="tabular block truncate text-xs text-ink-soft">
          {day?.shifts.length ? day.shifts.map((x) => `${formatClock(x.startMin)}–${formatClock(x.endMin)}`).join(" · ") : day?.closedReason ? `Zatvoreno: ${day.closedReason}` : "Ne radi"}
          {day?.isOverride && <span className="ml-1 font-medium text-lacquer">· izmjena</span>}
        </span>
      </span>
    </div>
  );
}

function DayHeader({
  date,
  weekdayIndex,
  isToday,
  shifts: day,
}: {
  date: string;
  weekdayIndex: number;
  isToday: boolean;
  shifts: CalendarData["staffDays"][number] | undefined;
}) {
  return (
    <Link href={`?d=${date}`} className="block px-3 py-2 hover:bg-paper" title="Otvori dan">
      <span className={clsx("block text-xs font-medium uppercase", isToday ? "text-lacquer" : "text-ink-faint")}>
        {WEEKDAYS[weekdayIndex].short} <span className="tabular font-display text-base normal-case">{Number(date.slice(8))}.</span>
      </span>
      <span className="tabular block truncate text-xs text-ink-soft">
        {day?.shifts.length ? day.shifts.map((x) => `${formatClock(x.startMin)}–${formatClock(x.endMin)}`).join(" · ") : day?.closedReason ? `Zatvoreno: ${day.closedReason}` : "Ne radi"}
        {day?.isOverride && <span className="ml-1 font-medium text-lacquer">· izmjena</span>}
      </span>
    </Link>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-full bg-paper p-0.5 ring-1 ring-line-strong" role="group">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={clsx("rounded-full px-3 py-1.5 text-sm font-medium transition-colors", value === v ? "bg-ink text-porcelain" : "text-ink-soft hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Chip({ active, dim, href, color, label }: { active: boolean; dim?: boolean; href: string; color?: string; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={clsx(
        "flex shrink-0 items-center gap-1.5 rounded-full py-1 text-sm whitespace-nowrap ring-1 transition-colors",
        color ? "pr-3 pl-1.5" : "px-3",
        active ? "bg-ink text-porcelain ring-ink" : "bg-paper text-ink-soft ring-line-strong hover:text-ink",
        dim && "opacity-50",
      )}
    >
      {color && <Swatch color={color} size="sm" />}
      {label}
    </Link>
  );
}

function Legend({ mode, catColors }: { mode: ColorMode; catColors: Map<string, string> }) {
  const entries: [string, string][] =
    mode === "status"
      ? (["booked", "confirmed", "completed", "no_show"] as const).map((s) => [STATUS_TONE[s].label, STATUS_TONE[s].accent])
      : mode === "usluga"
        ? [...catColors.entries()]
        : [];
  if (!entries.length) return null;
  return (
    <span className="hidden items-center gap-3 text-xs text-ink-soft xl:flex">
      {entries.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-lacquer" />
        Van smjene
      </span>
    </span>
  );
}

function Alerts({ alerts, today }: { alerts: CalendarData["alerts"]; today: string }) {
  const items = [
    alerts.conflictsAhead > 0 && {
      href: "/app/radnici/smjene",
      icon: AlertTriangle,
      tone: "text-lacquer-deep bg-lacquer-wash ring-lacquer/20",
      text: `${alerts.conflictsAhead} ${plural(alerts.conflictsAhead, "termin", "termina", "termina")} van radnog vremena`,
    },
    alerts.handoffs > 0 && {
      href: "/app/razgovori",
      icon: MessagesSquare,
      tone: "text-amber bg-amber-wash ring-amber/20",
      text: `${alerts.handoffs} ${plural(alerts.handoffs, "razgovor čeka", "razgovora čekaju", "razgovora čeka")} odgovor`,
    },
    alerts.unconfirmedTomorrow > 0 && {
      href: `?v=lista&d=${shiftDate(today, 1)}`,
      icon: Clock3,
      tone: "text-ink-soft bg-paper ring-line-strong",
      text: `Sutra ${alerts.unconfirmedTomorrow} ${plural(alerts.unconfirmedTomorrow, "nepotvrđen termin", "nepotvrđena termina", "nepotvrđenih termina")}`,
    },
  ].filter(Boolean) as { href: string; icon: typeof AlertTriangle; tone: string; text: string }[];
  if (!items.length) return null;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map((a) => (
        <Link key={a.text} href={a.href} className={clsx("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ring-1", a.tone)}>
          <a.icon size={15} /> {a.text}
        </Link>
      ))}
    </div>
  );
}

function SetupChecklist({ hasServices, hasStaff }: { hasServices: boolean; hasStaff: boolean }) {
  const steps = [
    { done: hasServices, title: "Unesite usluge i cijene", text: "Trajanje svake usluge određuje koliko termin traje.", href: "/app/usluge", cta: "Otvori usluge" },
    { done: hasStaff, title: "Dodajte radnike i radno vrijeme", text: "Za svakog radnika: kada radi i koje usluge radi.", href: "/app/radnici", cta: "Otvori radnike" },
    { done: false, title: "Podijelite link za zakazivanje", text: "Stavite ga u Instagram bio i na Google profil salona.", href: "/app/postavke", cta: "Pogledaj link" },
  ];
  return (
    <div className="px-4 pb-10 sm:px-8">
      <div className="max-w-xl rounded-[var(--radius-card)] bg-paper p-6 ring-1 ring-line">
        <p className="font-display text-2xl">Pripremimo kalendar</p>
        <p className="mt-1 text-ink-soft">Tri koraka i salon je spreman za prve termine.</p>
        {(!hasServices || !hasStaff) && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[var(--radius-chip)] bg-lacquer-wash/50 p-3 ring-1 ring-lacquer/20">
            <span className="flex-1 text-sm">
              <strong>Brzo postavljanje:</strong> odaberite tip salona i dobićete gotov cjenovnik, radnike i radno vrijeme za 5 minuta.
            </span>
            <Link href="/app/postavljanje" className="rounded-full bg-lacquer px-4 py-2 text-sm font-medium text-white hover:bg-lacquer-deep">
              Pokreni
            </Link>
          </div>
        )}
        <ol className="mt-6 space-y-5">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span
                className={clsx(
                  "tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  s.done ? "bg-mint text-white" : "bg-porcelain text-ink ring-1 ring-line-strong",
                )}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span className="flex-1">
                <span className={clsx("block font-medium", s.done && "text-ink-soft line-through")}>{s.title}</span>
                <span className="block text-sm text-ink-soft">{s.text}</span>
                {!s.done && (
                  <Link href={s.href} className="mt-1.5 inline-block text-sm font-medium text-lacquer hover:underline">
                    {s.cta} →
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
