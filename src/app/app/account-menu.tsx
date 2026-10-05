"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/format";
import { switchSalonAction } from "./switch-salon-action";

/**
 * Gornja traka na telefonu i tabletu (bočna traka se vidi tek na većem ekranu):
 * naziv salona i meni naloga — ko je prijavljen, promjena salona, odjava.
 */
export function MobileTopBar({
  salonName,
  salonSlug,
  userName,
  userEmail,
  roleLabel,
  salons,
  currentSalonId,
}: {
  salonName: string;
  salonSlug: string;
  userName: string;
  userEmail: string;
  roleLabel: string;
  salons: { id: string; name: string }[];
  currentSalonId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const item = "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-[0.9375rem] outline-none data-[highlighted]:bg-porcelain";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
      <Link href="/app/kalendar" className="min-w-0 flex-1">
        <span className="block truncate font-display text-lg leading-tight">{salonName}</span>
      </Link>
      <Menu.Root>
        <Menu.Trigger
          aria-label="Nalog i odjava"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-sm text-porcelain outline-none focus-visible:ring-2 focus-visible:ring-lacquer focus-visible:ring-offset-2"
        >
          {initials(userName)}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="end"
            sideOffset={8}
            className="z-50 w-72 animate-[rise_160ms_ease-out] rounded-[var(--radius-card)] bg-paper p-1.5 shadow-[var(--shadow-pop)] ring-1 ring-line"
          >
            <div className="px-3 pt-2 pb-3">
              <p className="truncate font-medium">{userName}</p>
              <p className="truncate text-sm text-ink-soft">{userEmail}</p>
              <p className="mt-1 text-xs text-ink-faint">
                {roleLabel} · {salonName}
              </p>
            </div>
            {salons.length > 1 && (
              <>
                <Menu.Separator className="my-1 h-px bg-line" />
                <Menu.Label className="px-3 pt-1.5 pb-1 text-xs font-medium tracking-wide text-ink-faint uppercase">Salon</Menu.Label>
                {salons.map((s) => (
                  <Menu.Item
                    key={s.id}
                    disabled={pending}
                    className={item}
                    onSelect={() =>
                      s.id !== currentSalonId &&
                      start(async () => {
                        await switchSalonAction(s.id);
                        router.push("/app/kalendar");
                        router.refresh();
                      })
                    }
                  >
                    <span className="w-4">{s.id === currentSalonId && <Check size={16} />}</span>
                    <span className="truncate">{s.name}</span>
                  </Menu.Item>
                ))}
              </>
            )}
            <Menu.Separator className="my-1 h-px bg-line" />
            <Menu.Item asChild className={item}>
              <a href={`/s/${salonSlug}`} target="_blank" rel="noreferrer">
                <ExternalLink size={16} className="text-ink-soft" /> Stranica za klijente
              </a>
            </Menu.Item>
            <Menu.Item
              className={`${item} text-lacquer-deep`}
              onSelect={async () => {
                await authClient.signOut();
                router.push("/prijava");
                router.refresh();
              }}
            >
              <LogOut size={16} /> Odjava
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </header>
  );
}
