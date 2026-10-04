import { clsx } from "clsx";
import { swatch } from "@/lib/swatches";

/**
 * Uzorak boje radnika — kao pramen na karti boja za kosu,
 * sa brojem tona u uglu.
 */
export function Swatch({
  color,
  size = "md",
  showTone = true,
  className,
}: {
  color: string;
  size?: "sm" | "md" | "lg";
  showTone?: boolean;
  className?: string;
}) {
  const s = swatch(color);
  const dims = { sm: "h-5 w-4", md: "h-9 w-7", lg: "h-14 w-11" }[size];
  return (
    <span
      aria-hidden
      className={clsx(
        "relative inline-flex shrink-0 items-end justify-center overflow-hidden rounded-t-[40%] rounded-b-[3px] shadow-[inset_0_-6px_8px_-4px_rgb(0_0_0/0.25),inset_0_1px_0_rgb(255_255_255/0.25)]",
        dims,
        className,
      )}
      style={{
        background: `linear-gradient(100deg, ${s.hex} 0%, color-mix(in oklab, ${s.hex} 78%, white) 45%, ${s.hex} 70%, color-mix(in oklab, ${s.hex} 85%, black) 100%)`,
      }}
    >
      {showTone && size !== "sm" && (
        <span className="tabular mb-0.5 text-[9px] leading-none font-semibold tracking-tight text-white/90">
          {s.tone}
        </span>
      )}
    </span>
  );
}
