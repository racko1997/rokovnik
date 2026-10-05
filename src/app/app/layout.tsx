import { BrandMark } from "@/components/brand-mark";
import { ROLE_LABEL } from "@/lib/permissions";
import { getMemberships, requireSalon, requireUser } from "@/server/context";
import { MobileTopBar } from "./account-menu";
import { AppNav, MobileNav } from "./nav";
import { SalonSwitcher } from "./salon-switcher";
import { SignOutButton } from "./sign-out-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { salon, role } = await requireSalon();
  const user = await requireUser();
  const memberships = await getMemberships(user.id);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper/60 px-4 py-5 lg:flex">
        <BrandMark href="/app" className="px-2" />
        <div className="mt-8 px-2">
          <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">Salon</p>
          {memberships.length > 1 ? (
            <SalonSwitcher current={salon.id} salons={memberships.map((m) => ({ id: m.salon.id, name: m.salon.name }))} />
          ) : (
            <p className="mt-1 truncate font-display text-lg leading-snug">{salon.name}</p>
          )}
          <a
            href={`/s/${salon.slug}`}
            target="_blank"
            className="mt-0.5 block truncate text-sm text-ink-soft underline-offset-4 hover:text-lacquer hover:underline"
          >
            /s/{salon.slug} ↗
          </a>
        </div>
        <AppNav className="mt-8" role={role} />
        <div className="mt-auto space-y-3 border-t border-line px-2 pt-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-xs text-ink-soft">{ROLE_LABEL[role]}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="min-w-0 pb-20 lg:pb-0">
        <MobileTopBar
          salonName={salon.name}
          salonSlug={salon.slug}
          userName={user.name}
          userEmail={user.email}
          roleLabel={ROLE_LABEL[role]}
          currentSalonId={salon.id}
          salons={memberships.map((m) => ({ id: m.salon.id, name: m.salon.name }))}
        />
        {children}
      </div>
      <MobileNav role={role} />
    </div>
  );
}
