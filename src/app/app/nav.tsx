"use client";

import { clsx } from "clsx";
import { ChartColumn, CalendarDays, Contact, MessagesSquare, Scissors, Settings2, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Permission, type Role } from "@/lib/permissions";

// `desktopOnly`: na telefonu je u meniju naloga (gore desno), da donja traka ne bude pretijesna
const ALL_ITEMS: { href: string; label: string; icon: typeof CalendarDays; needs?: Permission; desktopOnly?: boolean }[] = [
  { href: "/app/kalendar", label: "Kalendar", icon: CalendarDays },
  { href: "/app/klijenti", label: "Klijenti", icon: Contact },
  { href: "/app/razgovori", label: "Razgovori", icon: MessagesSquare },
  { href: "/app/usluge", label: "Usluge", icon: Scissors, needs: "manageCatalog" },
  { href: "/app/radnici", label: "Radnici", icon: UsersRound },
  { href: "/app/analitika", label: "Analitika", icon: ChartColumn, needs: "viewRevenue" },
  { href: "/app/postavke", label: "Postavke", icon: Settings2, needs: "manageSettings", desktopOnly: true },
];

const itemsFor = (role: Role) => ALL_ITEMS.filter((i) => !i.needs || can(role, i.needs));

export function AppNav({ className, role }: { className?: string; role: Role }) {
  const pathname = usePathname();
  const ITEMS = itemsFor(role);
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

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const ITEMS = itemsFor(role).filter((i) => !i.desktopOnly);
  return (
    <nav
      style={{ gridTemplateColumns: `repeat(${ITEMS.length}, minmax(0, 1fr))` }}
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
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
