"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Menu as MenuIcon } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const SECTIONS = [
  { href: "#mogucnosti", label: "Mogućnosti" },
  { href: "#recepcioner", label: "AI recepcioner" },
  { href: "#pilot", label: "Pilot program" },
  { href: "#pitanja", label: "Pitanja" },
];

/** Navigacija naslovne na telefonu: dijelovi stranice i prijava (dugme "Otvori salon" ostaje vidljivo pored). */
export function LandingMobileMenu() {
  const { data: session } = authClient.useSession();
  const item = "flex cursor-pointer items-center rounded-lg px-3 py-3 text-base outline-none data-[highlighted]:bg-porcelain";
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label="Meni"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink ring-1 ring-line-strong outline-none focus-visible:ring-2 focus-visible:ring-lacquer md:hidden"
      >
        <MenuIcon size={18} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={10}
          className="z-50 w-[min(18rem,calc(100vw-2rem))] animate-[rise_160ms_ease-out] rounded-[var(--radius-card)] bg-paper p-1.5 shadow-[var(--shadow-pop)] ring-1 ring-line"
        >
          {SECTIONS.map((s) => (
            <Menu.Item key={s.href} asChild className={item}>
              <a href={s.href}>{s.label}</a>
            </Menu.Item>
          ))}
          {!session && (
            <>
              <Menu.Separator className="my-1 h-px bg-line" />
              <Menu.Item asChild className={item}>
                <Link href="/prijava">Prijava</Link>
              </Menu.Item>
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
