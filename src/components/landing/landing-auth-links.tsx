"use client";

import { ButtonLink } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Desni dio zaglavlja naslovne: prijavljeni vide "Moj kalendar" umjesto prijave. */
export function LandingAuthLinks() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <span className="h-8 w-28 sm:w-40" aria-hidden />;
  if (session) {
    return (
      <ButtonLink href="/app/kalendar" size="sm">
        Moj kalendar
      </ButtonLink>
    );
  }
  return (
    <>
      {/* Na telefonu je prijava u meniju, da zaglavlje ne bude pretrpano */}
      <ButtonLink href="/prijava" variant="ghost" size="sm" className="hidden sm:inline-flex">
        Prijava
      </ButtonLink>
      <ButtonLink href="/registracija" size="sm">
        Otvori salon
      </ButtonLink>
    </>
  );
}
