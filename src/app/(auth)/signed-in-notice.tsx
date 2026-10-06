"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Na prijavi/registraciji kad je korisnik već prijavljen — umjesto tihog preusmjeravanja. */
export function SignedInNotice({
  name,
  email,
  intent,
  next = "/app",
}: {
  name: string;
  email: string;
  intent: "login" | "signup";
  next?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <>
      <h1 className="font-display text-4xl leading-tight">Već ste prijavljeni</h1>
      <p className="mt-2 text-ink-soft">
        Kao <strong className="text-ink">{name}</strong> ({email}).
      </p>
      <div className="mt-8 space-y-3">
        <ButtonLink href={next} size="lg" className="w-full">
          Nastavi kao {name.split(" ")[0]}
        </ButtonLink>
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await authClient.signOut();
            router.refresh();
          }}
        >
          {intent === "signup" ? "Odjavi se i otvori novi nalog" : "Odjavi se i uđi drugim nalogom"}
        </Button>
      </div>
    </>
  );
}
