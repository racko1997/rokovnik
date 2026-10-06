"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ next = "/app" }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setPending(false);
      setError(error.status === 401 ? "Pogrešan email ili lozinka." : "Prijava nije uspjela. Pokušajte ponovo.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Lozinka">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Prijavljujem…" : "Prijavi se"}
      </Button>
    </form>
  );
}
