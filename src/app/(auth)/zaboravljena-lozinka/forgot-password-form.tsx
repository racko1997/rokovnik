"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/nova-lozinka" });
    setPending(false);
    if (error) {
      setError(error.status === 429 ? "Previše pokušaja. Sačekajte minut pa probajte ponovo." : "Slanje nije uspjelo. Pokušajte ponovo.");
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    // Isti odgovor postojao nalog ili ne — da se preko ove forme ne može provjeravati ko ima nalog
    return (
      <div className="mt-8 rounded-[var(--radius-card)] bg-paper px-4 py-4 ring-1 ring-line">
        <p className="font-medium">Provjerite inbox</p>
        <p className="mt-1 text-sm text-ink-soft">
          Ako postoji nalog za <strong className="text-ink">{sentTo}</strong>, link za novu lozinku stiže za minut. Link važi 1 sat. Pogledajte i
          neželjenu poštu.
        </p>
        <button type="button" onClick={() => setSentTo(null)} className="mt-3 text-sm text-lacquer underline-offset-4 hover:underline">
          Pogrešan email? Pošalji ponovo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Šaljem…" : "Pošalji link"}
      </Button>
    </form>
  );
}
