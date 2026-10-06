"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function NewPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword.length < 8) return setError("Lozinka mora imati najmanje 8 znakova.");
    if (newPassword !== String(form.get("confirm"))) return setError("Lozinke se ne poklapaju.");
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token });
    setPending(false);
    if (error) {
      setError(error.code === "INVALID_TOKEN" ? "Link je istekao ili je već iskorišten. Zatražite novi." : "Promjena nije uspjela. Pokušajte ponovo.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-8">
        <p className="rounded-[var(--radius-card)] bg-paper px-4 py-3 ring-1 ring-line">Lozinka je promijenjena.</p>
        <ButtonLink href="/prijava" size="lg" className="mt-4 w-full">
          Prijavite se
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <Field label="Nova lozinka">
        <Input name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
      </Field>
      <Field label="Ponovite lozinku">
        <Input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Spremam…" : "Postavi lozinku"}
      </Button>
    </form>
  );
}
