"use client";

import { clsx } from "clsx";
import { MessageSquareText, Plus, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { formatClock } from "@/lib/format";
import type { BlockTone } from "./colors";
import { SOURCE_LABEL, type CalBlock, type StaffDay } from "./types";

/** Jedna kolona mreže: radnik u dnevnom prikazu, dan u sedmičnom. */
export interface GridColumn {
  key: string;
  date: string;
  staffId: string;
  header: ReactNode;
  day: StaffDay | undefined;
  blocks: CalBlock[];
  isToday: boolean;
}

interface DragState {
  block: CalBlock;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  colKey: string;
  startMin: number;
  originColKey: string;
}

const SNAP = 5;

export function TimeGrid({
  columns,
  dayStart,
  dayEnd,
  hourPx,
  nowMin,
  conflictKeys,
  toneFor,
  partTone,
  onSelect,
  onEmptyClick,
  onMove,
  minColWidth = "10rem",
}: {
  columns: GridColumn[];
  dayStart: number;
  dayEnd: number;
  hourPx: number;
  nowMin: number;
  conflictKeys: Set<string>;
  toneFor: (b: CalBlock) => BlockTone;
  /** Boja pojedine usluge — kad je zadana, posjeta s više usluga se crta u trakama */
  partTone?: (serviceId: string) => BlockTone;
  onSelect: (b: CalBlock) => void;
  onEmptyClick: (col: GridColumn, startMin: number) => void;
  /** Vraća true ako je pomjeranje uspjelo; inače se blok vraća na staro mjesto. */
  onMove: (b: CalBlock, col: GridColumn, startMin: number) => Promise<boolean>;
  minColWidth?: string;
}) {
  const px = hourPx / 60;
  const height = (dayEnd - dayStart) * px;
  const hours = Array.from({ length: (dayEnd - dayStart) / 60 }, (_, i) => dayStart + i * 60);
  const [drag, setDrag] = useState<DragState | null>(null);
  /** Blok koji čeka odgovor servera nakon spuštanja */
  const [pending, setPending] = useState<{ key: string; colKey: string; startMin: number } | null>(null);
  const columnsRef = useRef(new Map<string, HTMLDivElement>());

  const minuteAt = (col: HTMLDivElement, clientY: number, snap = 15) => {
    const rect = col.getBoundingClientRect();
    const min = dayStart + (clientY - rect.top) / px;
    return Math.max(dayStart, Math.min(dayEnd - snap, Math.floor(min / snap) * snap));
  };

  // ─── Prevlačenje (samo miš; na dodir se skrola) ────────────────────────────
  // Kretanje i otpuštanje pratimo na cijelom prozoru: originalni blok se sakrije
  // čim prevlačenje počne, pa ne može on primati događaje.
  const dragRef = useRef<DragState | null>(null);
  const latest = useRef({ columns, onMove, onSelect, dayStart, dayEnd, px });
  useLayoutEffect(() => {
    dragRef.current = drag;
    latest.current = { columns, onMove, onSelect, dayStart, dayEnd, px };
  });
  const dragging = drag !== null;

  function onBlockPointerDown(e: React.PointerEvent, b: CalBlock, colKey: string) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    if (b.status === "completed" || b.status === "no_show") return;
    e.preventDefault();
    setDrag({ block: b, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, colKey, startMin: b.startMin, originColKey: colKey });
  }

  useEffect(() => {
    if (!dragging) return;
    const onMoveEvt = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const { dayStart, dayEnd, px } = latest.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 5) return;
      let colKey = d.colKey;
      for (const [key, el] of columnsRef.current) {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX < r.right) colKey = key;
      }
      const duration = d.block.endMin - d.block.startMin;
      const raw = d.block.startMin + dy / px;
      const startMin = Math.max(dayStart, Math.min(dayEnd - duration, Math.round(raw / SNAP) * SNAP));
      setDrag({ ...d, moved: true, colKey, startMin });
    };
    const onUp = async (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      setDrag(null);
      const { columns, onMove, onSelect } = latest.current;
      if (!d.moved) return onSelect(d.block);
      if (d.colKey === d.originColKey && d.startMin === d.block.startMin) return;
      const col = columns.find((c) => c.key === d.colKey);
      if (!col) return;
      setPending({ key: d.block.key, colKey: d.colKey, startMin: d.startMin });
      await onMove(d.block, col, d.startMin);
      setPending(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrag(null);
    const cancel = () => setDrag(null);
    window.addEventListener("pointermove", onMoveEvt);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMoveEvt);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", onKey);
    };
  }, [dragging]);

  return (
    <div
      className="grid min-w-full"
      style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(${minColWidth}, 1fr))`, width: "max-content" }}
    >
      {/* Zaglavlje */}
      <div className="sticky top-0 left-0 z-30 border-b border-line bg-porcelain" style={{ gridRow: 1, gridColumn: 1 }} />
      {columns.map((c, i) => (
        <div key={c.key} style={{ gridRow: 1, gridColumn: i + 2 }} className="sticky top-0 z-20 border-b border-l border-line bg-porcelain">
          {c.header}
        </div>
      ))}

      {/* Sati */}
      <div className="sticky left-0 z-10 bg-porcelain" style={{ gridRow: 2, gridColumn: 1, height }}>
        {hours.map((h) => (
          <span
            key={h}
            className="tabular absolute right-2 -translate-y-1/2 font-display text-[0.8125rem] text-ink-faint first:translate-y-1"
            style={{ top: (h - dayStart) * px }}
          >
            {String(h / 60).padStart(2, "0")}
          </span>
        ))}
      </div>

      {columns.map((c, i) => {
        // Blokovi u ovoj koloni: originalni (osim onog koji se vuče) + "duh" ako se vuče ovdje
        const active = drag?.moved ? drag : null;
        const ghost =
          active && active.colKey === c.key
            ? { block: active.block, startMin: active.startMin }
            : pending && pending.colKey === c.key
              ? { block: columns.flatMap((x) => x.blocks).find((b) => b.key === pending.key), startMin: pending.startMin }
              : null;
        const hidden = new Set([active?.block.key, pending?.key].filter(Boolean));
        return (
          <Column
            key={c.key}
            col={c}
            gridColumn={i + 2}
            dayStart={dayStart}
            dayEnd={dayEnd}
            hourPx={hourPx}
            height={height}
            registerRef={(el) => (el ? columnsRef.current.set(c.key, el) : columnsRef.current.delete(c.key))}
            minuteAt={minuteAt}
            onEmptyClick={onEmptyClick}
            isDragging={Boolean(active)}
          >
            {c.blocks
              .filter((b) => !hidden.has(b.key))
              .map((b) => (
                <Block
                  key={b.key}
                  block={b}
                  startMin={b.startMin}
                  dayStart={dayStart}
                  px={px}
                  tone={toneFor(b)}
                  partTone={partTone}
                  conflict={conflictKeys.has(b.key)}
                  indent={c.blocks.some((o) => o.key !== b.key && o.gaps.some((g) => b.startMin >= g.startMin && b.endMin <= g.endMin))}
                  onPointerDown={(e) => onBlockPointerDown(e, b, c.key)}
                  onClick={(e) => {
                    // Klik mišem obrađuje pointerup; ovo je za tastaturu i dodir
                    if (e.detail === 0 || (e.nativeEvent as PointerEvent).pointerType !== "mouse") onSelect(b);
                  }}
                />
              ))}
            {ghost?.block && (
              <Block
                block={ghost.block}
                startMin={ghost.startMin}
                dayStart={dayStart}
                px={px}
                tone={toneFor(ghost.block)}
                partTone={partTone}
                conflict={false}
                ghost
                saving={Boolean(pending)}
              />
            )}
          </Column>
        );
      })}

      {columns.some((c) => c.isToday) && nowMin >= dayStart && nowMin <= dayEnd && (
        <div
          aria-hidden
          className="pointer-events-none z-10 flex h-0 items-center self-start"
          style={{ gridRow: 2, gridColumn: "1 / -1", marginTop: (nowMin - dayStart) * px }}
        >
          <span className="tabular sticky left-0 w-14 bg-porcelain pr-1.5 text-right text-[0.6875rem] font-semibold text-lacquer">
            {formatClock(nowMin)}
          </span>
          <span className="h-2 w-2 shrink-0 -translate-x-1 rounded-full bg-lacquer" />
          <span className="h-px flex-1 bg-lacquer/70" />
        </div>
      )}
    </div>
  );
}

function Column({
  col,
  gridColumn,
  dayStart,
  dayEnd,
  hourPx,
  height,
  registerRef,
  minuteAt,
  onEmptyClick,
  isDragging,
  children,
}: {
  col: GridColumn;
  gridColumn: number;
  dayStart: number;
  dayEnd: number;
  hourPx: number;
  height: number;
  registerRef: (el: HTMLDivElement | null) => void;
  minuteAt: (col: HTMLDivElement, clientY: number) => number;
  onEmptyClick: (col: GridColumn, startMin: number) => void;
  isDragging: boolean;
  children: ReactNode;
}) {
  const px = hourPx / 60;
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  const shifts = col.day?.shifts ?? [];
  return (
    <div
      ref={registerRef}
      role="presentation"
      className={clsx("off-hours relative cursor-cell border-l border-line", col.isToday && "shadow-[inset_0_2px_0_var(--lacquer)]")}
      style={{ gridRow: 2, gridColumn, height, ["--hour" as string]: `${hourPx}px` }}
      onClick={(e) => onEmptyClick(col, minuteAt(e.currentTarget, e.clientY))}
      onMouseMove={(e) => !isDragging && setHoverMin(minuteAt(e.currentTarget, e.clientY))}
      onMouseLeave={() => setHoverMin(null)}
    >
      {shifts.map((s, i) => (
        <div
          key={i}
          className="ruled absolute inset-x-0 bg-paper"
          style={{
            top: (s.startMin - dayStart) * px,
            height: (s.endMin - s.startMin) * px,
            backgroundPosition: `0 ${-((s.startMin - dayStart) % 60) * px}px, 0 ${hourPx / 2 - ((s.startMin - dayStart) % 60) * px}px`,
          }}
        />
      ))}

      {col.day?.absences.map((a, i) => (
        <div
          key={i}
          className="absolute inset-x-0 flex items-start bg-amber-wash/90 px-2 pt-1 text-xs font-medium text-amber [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(168_104_26/0.12)_6px_8px)]"
          style={{ top: (Math.max(a.startMin, dayStart) - dayStart) * px, height: (Math.min(a.endMin, dayEnd) - Math.max(a.startMin, dayStart)) * px }}
        >
          {a.reason || "Odsutan/na"}
        </div>
      ))}

      {hoverMin !== null && !isDragging && (
        <div
          className="pointer-events-none absolute inset-x-1 flex h-6 items-center rounded-md px-2 text-xs font-medium text-ink-soft ring-1 ring-ink/15 ring-inset"
          style={{ top: (hoverMin - dayStart) * px }}
        >
          <Plus size={12} className="mr-1" /> {formatClock(hoverMin)}
        </div>
      )}

      {children}
    </div>
  );
}

function Block({
  block: b,
  startMin,
  dayStart,
  px,
  tone,
  partTone,
  conflict,
  indent,
  ghost,
  saving,
  onPointerDown,
  onClick,
}: {
  block: CalBlock;
  startMin: number;
  dayStart: number;
  px: number;
  tone: BlockTone;
  partTone?: (serviceId: string) => BlockTone;
  conflict: boolean;
  /** Termin upisan u vrijeme djelovanja drugog termina — uvučen da se vidi oboje */
  indent?: boolean;
  ghost?: boolean;
  saving?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const shift = startMin - b.startMin;
  const duration = b.endMin - b.startMin;
  const buffer = b.blockedMin - b.endMin;
  const noShow = b.status === "no_show";
  const source = SOURCE_LABEL[b.source];
  const accent = conflict ? "var(--lacquer)" : tone.accent;
  const endMin = startMin + duration;
  const x = indent ? "left-[30%] right-1" : "inset-x-1";

  // Dijelovi u kojima radnik radi (između njih je vrijeme djelovanja)
  const segments: [number, number][] = [];
  let cursor = b.startMin;
  for (const g of b.gaps) {
    segments.push([cursor, g.startMin]);
    cursor = g.endMin;
  }
  segments.push([cursor, b.endMin]);
  const [firstStart, firstEnd] = segments[0];
  const height = (firstEnd - firstStart) * px;
  const compact = height < 46;

  const handlers = {
    onPointerDown,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(e);
    },
    onMouseMove: (e: React.MouseEvent) => e.stopPropagation(),
    tabIndex: ghost ? -1 : 0,
  };
  const segmentClass = clsx(
    "absolute z-[1] flex flex-col overflow-hidden rounded-md text-left select-none",
    x,
    ghost ? "z-[3] cursor-grabbing shadow-[var(--shadow-pop)] ring-2 ring-ink/30" : "cursor-pointer transition-shadow hover:z-[2] hover:shadow-[var(--shadow-lift)]",
    indent && "z-[2] shadow-[var(--shadow-lift)]",
    saving && "animate-pulse",
    noShow && "opacity-55",
    conflict && "ring-2 ring-lacquer",
  );
  // Posjeta s više usluga: svaka usluga svoja traka u svojoj boji (npr. pramenovi + feniranje)
  const multi = Boolean(partTone) && !conflict && !tone.muted && new Set(b.parts.map((p) => p.serviceId)).size > 1;
  const segmentStyle = (from: number, to: number) => ({
    top: (from + shift - dayStart) * px + 1,
    height: (to - from) * px - 2,
    background: multi ? "var(--paper)" : conflict ? "var(--lacquer-wash)" : tone.fill,
    boxShadow: multi ? "none" : `inset 3px 0 0 ${accent}`,
  });
  const bands = (from: number, to: number, labelFirst: boolean) =>
    multi
      ? b.parts
          .filter((p) => p.endMin > from && p.startMin < to)
          .map((p, i) => {
            const t = partTone!(p.serviceId);
            const top = (Math.max(p.startMin, from) - from) * px;
            const height = (Math.min(p.endMin, to) - Math.max(p.startMin, from)) * px;
            return (
              <span
                key={`${p.serviceId}-${p.startMin}`}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 overflow-hidden"
                style={{ top, height, background: t.fill, boxShadow: `inset 3px 0 0 ${t.accent}` }}
              >
                {(labelFirst || i > 0) && height >= 18 && (
                  <span className="absolute top-0.5 left-2.5 truncate text-[0.6875rem] font-medium" style={{ color: t.accent }}>
                    {p.continuation ? `↳ ${p.name}` : p.name}
                  </span>
                )}
              </span>
            );
          })
      : null;

  return (
    <>
      {buffer > 0 && !ghost && (
        <div
          className={clsx("pointer-events-none absolute rounded-b-md [background-image:repeating-linear-gradient(135deg,transparent_0_4px,var(--line-strong)_4px_5px)]", x)}
          style={{ top: (b.endMin - dayStart) * px, height: buffer * px }}
          title="Pauza nakon usluge"
        />
      )}

      {b.gaps.map((g, i) => (
        // Djelovanje: radnik je slobodan — klik ovdje otvara novi termin
        <div
          key={i}
          className={clsx("pointer-events-none absolute flex items-center overflow-hidden rounded-sm px-2", x)}
          style={{
            top: (g.startMin + shift - dayStart) * px,
            height: (g.endMin - g.startMin) * px,
            boxShadow: `inset 3px 0 0 color-mix(in oklab, ${accent} 40%, transparent)`,
            backgroundImage: `repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, ${accent} 18%, transparent) 6px 8px)`,
          }}
        >
          {(g.endMin - g.startMin) * px >= 22 && (
            <span className="truncate text-[0.6875rem] font-medium" style={{ color: accent }}>
              djelovanje {g.endMin - g.startMin} min · slobodno
            </span>
          )}
        </div>
      ))}

      <button type="button" {...handlers} className={clsx(segmentClass, compact ? "justify-center px-2 py-0.5" : "px-2.5 py-1.5")} style={segmentStyle(firstStart, firstEnd)}>
        {bands(firstStart, firstEnd, false)}
        <span className={clsx("relative flex items-center gap-1.5 text-[0.875rem] leading-tight", compact && "truncate")}>
          <span className={clsx("truncate font-semibold", noShow && "line-through", tone.muted && "text-ink-soft")}>
            {b.client?.name ?? "Bez imena"}
          </span>
          {b.firstVisit && (
            <span title="Prva posjeta" className="shrink-0 text-amber">
              <Sparkles size={12} />
            </span>
          )}
          {(b.notes || b.client?.notes) && (
            <span title={[b.client?.notes, b.notes].filter(Boolean).join(" · ")} className={clsx("shrink-0", b.client?.notes ? "text-amber" : "text-ink-faint")}>
              <MessageSquareText size={12} />
            </span>
          )}
          {compact && <span className="truncate text-[0.8125rem] font-normal text-ink-soft">{b.services.map((s) => s.name).join(", ")}</span>}
        </span>
        {!compact && (
          <>
            {!multi && <span className="truncate text-[0.8125rem] leading-snug text-ink-soft">{b.services.map((s) => s.name).join(" + ")}</span>}
            {multi && <span className="relative truncate text-[0.8125rem] leading-snug text-ink-soft">{b.parts[0].name}</span>}
            <span className="tabular relative mt-auto flex flex-wrap items-center gap-1.5 pt-0.5 text-[0.75rem] text-ink-soft">
              {formatClock(startMin)}–{formatClock(endMin)}
              {b.status === "confirmed" && <span className="font-semibold text-mint">✓</span>}
              {source && (
                <span className="rounded-full px-1.5 py-px font-medium" style={{ background: `color-mix(in oklab, ${accent} 16%, transparent)`, color: accent }}>
                  {source}
                </span>
              )}
              {conflict && <span className="font-semibold text-lacquer">van smjene</span>}
            </span>
          </>
        )}
      </button>

      {segments.slice(1).map(([from, to]) => (
        <button key={from} type="button" {...handlers} className={clsx(segmentClass, "justify-center px-2 py-0.5")} style={segmentStyle(from, to)}>
          {bands(from, to, true)}
          <span className={clsx("relative truncate text-[0.75rem] text-ink-soft", multi && "sr-only")}>
            ↳ nastavak · <span className="font-medium text-ink">{b.client?.name ?? "Bez imena"}</span>
          </span>
        </button>
      ))}
    </>
  );
}
