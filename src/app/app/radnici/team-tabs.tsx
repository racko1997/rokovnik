"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/radnici", label: "Radnici" },
  { href: "/app/radnici/smjene", label: "Smjene" },
  { href: "/app/radnici/pristup", label: "Pristup", access: true },
];

export function TeamTabs({ showAccess }: { showAccess: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-6 border-b border-line px-4 pt-4 sm:px-8" aria-label="Tim">
      {TABS.filter((t) => !t.access || showAccess).map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "-mb-px border-b-2 pb-2.5 text-[0.9375rem] font-medium transition-colors",
              active ? "border-lacquer text-ink" : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
