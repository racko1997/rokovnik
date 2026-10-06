"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button, ButtonLink } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Prijavljen korisnik bez pristupa administraciji — kaže kojim je nalogom ušao i kako dalje. */
export function NoAdminAccess({ email, configured }: { email: string; configured: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <BrandMark href="/" />
      <h1 className="mt-10 font-display text-4xl leading-tight">Nemate pristup</h1>
      <p className="mt-3 text-ink-soft">
        Prijavljeni ste kao <strong className="text-ink">{email}</strong>, a ovaj nalog nije na listi administratora platforme.
      </p>
      {!configured && (
        <p className="mt-3 rounded-[var(--radius-card)] bg-porcelain px-4 py-3 text-sm text-ink-soft">
          Lista administratora je prazna — nova postavka na serveru postaje aktivna tek nakon novog objavljivanja aplikacije.
        </p>
      )}
      <div className="mt-8 space-y-3">
        <Button
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await authClient.signOut();
            router.push("/prijava?next=/admin/prijave");
          }}
        >
          Odjavi se i uđi drugim nalogom
        </Button>
        <ButtonLink href="/app" variant="secondary" size="lg" className="w-full">
          Nazad u kalendar
        </ButtonLink>
      </div>
    </div>
  );
}
