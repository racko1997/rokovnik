import { BrandMark } from "@/components/brand-mark";
import { requireSalon } from "@/server/context";
import { AppNav, MobileNav } from "./nav";
import { SignOutButton } from "./sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { salon } = await requireSalon();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper/60 px-4 py-5 lg:flex">
        <BrandMark href="/app" className="px-2" />
        <div className="mt-8 px-2">
          <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">Salon</p>
          <p className="mt-1 truncate font-display text-lg leading-snug">{salon.name}</p>
          <a
            href={`/s/${salon.slug}`}
            target="_blank"
            className="mt-0.5 block truncate text-sm text-ink-soft underline-offset-4 hover:text-lacquer hover:underline"
          >
            /s/{salon.slug} ↗
          </a>
        </div>
        <AppNav className="mt-8" />
        <div className="mt-auto px-2">
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 pb-20 lg:pb-0">{children}</div>
      <MobileNav />
    </div>
  );
}
