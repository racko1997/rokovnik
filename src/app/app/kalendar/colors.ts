// Boje termina u kalendaru. Salon bira izvor boje: status, kategorija usluge ili radnik.
// Crvena (lak) je rezervisana za termine van radnog vremena — nijedan režim je ne koristi.
import { swatch } from "@/lib/swatches";
import type { CalBlock, ColorMode, Status } from "./types";

export interface BlockTone {
  /** Lijeva traka i oznake */
  accent: string;
  /** Pozadina bloka */
  fill: string;
  /** Prigušen tekst (završeni termini) */
  muted?: boolean;
}

export const STATUS_TONE: Record<Status, { accent: string; label: string }> = {
  booked: { accent: "#5B6FB5", label: "Zakazano" },
  confirmed: { accent: "#2E7A66", label: "Potvrđeno" },
  completed: { accent: "#9A92A3", label: "Završeno" },
  no_show: { accent: "#A8681A", label: "Nije došao/la" },
  cancelled: { accent: "#9A92A3", label: "Otkazano" },
};

/** Boje kategorija usluga, dodjeljuju se redom kojim su kategorije u cjenovniku. */
const CATEGORY_PALETTE = ["#5B6FB5", "#B2742A", "#3E8A7A", "#9B4F96", "#6E7F3A", "#4C7FA8", "#A3574A", "#7A6A3E"];

const tint = (hex: string, pct = 14) => `color-mix(in oklab, ${hex} ${pct}%, var(--paper))`;

export function categoryColors(categories: (string | null)[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) {
    const key = c ?? "Ostalo";
    if (!map.has(key)) map.set(key, CATEGORY_PALETTE[map.size % CATEGORY_PALETTE.length]);
  }
  return map;
}

export function blockTone(
  block: CalBlock,
  mode: ColorMode,
  ctx: { staffColor: string; categoryOf: (serviceId: string) => string | null; categoryColor: Map<string, string> },
): BlockTone {
  if (block.status === "completed") return { accent: STATUS_TONE.completed.accent, fill: "var(--porcelain)", muted: true };
  if (mode === "status") {
    const accent = STATUS_TONE[block.status].accent;
    return { accent, fill: tint(accent, block.status === "booked" ? 11 : 14) };
  }
  if (mode === "usluga") {
    const accent = ctx.categoryColor.get(ctx.categoryOf(block.services[0].id) ?? "Ostalo") ?? CATEGORY_PALETTE[0];
    return { accent, fill: tint(accent) };
  }
  const accent = swatch(ctx.staffColor).hex;
  return { accent, fill: tint(accent, 16) };
}
