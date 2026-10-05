// Boje termina u kalendaru. Salon bira izvor boje: usluga (zadano), status ili radnik.
// Crvena (lak) je rezervisana za termine van radnog vremena — nijedan režim je ne koristi.
import { serviceColor } from "@/lib/service-colors";
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

export const tint = (hex: string, pct = 14) => `color-mix(in oklab, ${hex} ${pct}%, var(--paper))`;

/** Ton jedne usluge (za trake unutar posjete s više usluga). */
export function serviceTone(colorKey: string): BlockTone {
  const accent = serviceColor(colorKey).hex;
  return { accent, fill: tint(accent, 16) };
}

export function blockTone(
  block: CalBlock,
  mode: ColorMode,
  ctx: { staffColor: string; serviceColorOf: (serviceId: string) => string },
): BlockTone {
  // Završeni termini su uvijek prigušeni, u svakom režimu
  if (block.status === "completed") return { accent: STATUS_TONE.completed.accent, fill: "var(--porcelain)", muted: true };
  if (mode === "status") {
    const accent = STATUS_TONE[block.status].accent;
    return { accent, fill: tint(accent, block.status === "booked" ? 11 : 14) };
  }
  if (mode === "usluga") return serviceTone(ctx.serviceColorOf(block.services[0]?.id ?? ""));
  const accent = swatch(ctx.staffColor).hex;
  return { accent, fill: tint(accent, 16) };
}
