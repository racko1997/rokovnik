"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 8) {
      setError("Lozinka mora imati bar 8 znakova.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password,
    });
    if (error) {
      setPending(false);
      setError(
        error.code === "USER_ALREADY_EXISTS" || error.status === 422
          ? "Nalog s ovim emailom već postoji. Prijavite se."
          : "Registracija nije uspjela. Pokušajte ponovo.",
      );
      return;
    }
    router.push("/novi-salon");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <Field label="Ime i prezime">
        <Input name="name" autoComplete="name" required autoFocus />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Lozinka" hint="Najmanje 8 znakova.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Otvaram nalog…" : "Otvori nalog"}
      </Button>
    </form>
  );
}
