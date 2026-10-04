"use client";

import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { acceptInviteAction } from "./actions";

export function AcceptInvite({
  token,
  email,
  defaultName,
  signedInAs,
}: {
  token: string;
  email: string | null;
  defaultName: string;
  signedInAs: { name: string; email: string } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function accept() {
    const res = await acceptInviteAction(token);
    if (!res.ok) {
      setPending(false);
      return setError(res.error);
    }
    router.push("/app");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const credentials = { email: String(f.get("email")), password: String(f.get("password")) };
    const { error } =
      mode === "new"
        ? await authClient.signUp.email({ ...credentials, name: String(f.get("name")) })
        : await authClient.signIn.email(credentials);
    if (error) {
      setPending(false);
      return setError(
        mode === "new"
          ? error.code === "USER_ALREADY_EXISTS" || error.status === 422
            ? "Nalog s ovim emailom već postoji — odaberite „Imam nalog“."
            : "Lozinka mora imati bar 8 znakova."
          : "Pogrešan email ili lozinka.",
      );
    }
    await accept();
  }

  if (signedInAs) {
    return (
      <div className="mt-8 space-y-4">
        <p className="rounded-[var(--radius-chip)] bg-paper px-3 py-2.5 text-sm ring-1 ring-line">
          Prijavljeni ste kao <strong>{signedInAs.name}</strong> ({signedInAs.email}).
        </p>
        <FormError message={error} />
        <Button
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={() => {
            setPending(true);
            accept();
          }}
        >
          {pending ? "Pridružujem…" : "Pridruži se salonu"}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-ink-soft hover:text-ink"
          onClick={async () => {
            await authClient.signOut();
            router.refresh();
          }}
        >
          Nisam ja — odjavi se
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex w-fit gap-1 rounded-full bg-paper p-1 text-sm ring-1 ring-line">
        {(
          [
            ["new", "Novi nalog"],
            ["existing", "Imam nalog"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={clsx("rounded-full px-4 py-1.5 font-medium", mode === m ? "bg-ink text-porcelain" : "text-ink-soft")}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        {mode === "new" && (
          <Field label="Ime i prezime">
            <Input name="name" required defaultValue={defaultName} autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" required defaultValue={email ?? ""} autoComplete="email" />
        </Field>
        <Field label="Lozinka" hint={mode === "new" ? "Najmanje 8 znakova." : undefined}>
          <Input name="password" type="password" required minLength={8} autoComplete={mode === "new" ? "new-password" : "current-password"} />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Samo trenutak…" : mode === "new" ? "Napravi nalog i pridruži se" : "Prijavi se i pridruži"}
        </Button>
      </form>
    </div>
  );
}
