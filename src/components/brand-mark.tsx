import { clsx } from "clsx";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

/** Logo: korica rokovnika sa trakom-označivačem. */
export function BrandMark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-2.5 text-ink", className)}>
      <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden>
        <rect x="1" y="1" width="20" height="24" rx="3" fill="var(--ink)" />
        <rect x="4" y="1" width="1.5" height="24" fill="var(--porcelain)" opacity="0.25" />
        <path d="M14 0h4v12l-2-1.6-2 1.6z" fill="var(--lacquer)" />
      </svg>
      <span className="font-display text-xl leading-none">{APP_NAME}</span>
    </Link>
  );
}
