"use client";

import { clsx } from "clsx";
import { CalendarDays, MessagesSquare, Scissors, Settings2, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app/kalendar", label: "Kalendar", icon: CalendarDays },
  { href: "/app/razgovori", label: "Razgovori", icon: MessagesSquare },
  { href: "/app/usluge", label: "Usluge", icon: Scissors },
  { href: "/app/radnici", label: "Radnici", icon: UsersRound },
  { href: "/app/postavke", label: "Postavke", icon: Settings2 },
];

export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={clsx("space-y-0.5", className)}>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-2 py-2 text-[0.9375rem] transition-colors",
              active ? "bg-ink text-porcelain" : "text-ink-soft hover:bg-ink/5 hover:text-ink",
            )}
          >
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex flex-col items-center gap-0.5 py-2.5 text-[0.6875rem] font-medium",
              active ? "text-lacquer" : "text-ink-soft",
            )}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
