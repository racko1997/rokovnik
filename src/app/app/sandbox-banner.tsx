"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Probni salon: jasno da je proba i koliko još traje, uz poziv da otvore svoj salon.
 * "Otvori svoj salon" prvo odjavljuje probni nalog, da registracija krene čisto.
 */
export function SandboxBanner({ hoursLeft }: { hoursLeft: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-ink px-4 py-2.5 text-sm text-porcelain sm:px-6">
      <p className="text-porcelain/85">
        <strong className="font-semibold text-porcelain">Probni salon.</strong> Slobodno mijenjajte i isprobavajte sve — briše se za{" "}
        {hoursLeft <= 1 ? "manje od sat" : `${hoursLeft} h`}.
      </p>
      <button
        type="button"
        disabled={pending}
        className="rounded-full bg-lacquer px-3.5 py-1.5 font-medium text-white hover:bg-lacquer-deep disabled:opacity-70"
        onClick={async () => {
          setPending(true);
          await authClient.signOut();
          router.push("/registracija");
        }}
      >
        Otvori svoj salon za 5 minuta →
      </button>
    </div>
  );
}
