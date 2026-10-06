"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Blaga potvrda emaila: aplikacija radi normalno, ovo samo podsjeća dok adresa nije potvrđena. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  return (
    <div className="border-b border-line bg-paper px-4 py-2.5 text-sm sm:px-6">
      <p className="text-ink-soft">
        Potvrdite email <strong className="font-medium text-ink">{email}</strong> — link je u inboxu. Na tu adresu stiže i link za novu lozinku.{" "}
        {state === "sent" ? (
          <span className="text-ink">Poslano ponovo.</span>
        ) : (
          <button
            type="button"
            disabled={state === "sending"}
            className="font-medium text-lacquer underline-offset-4 hover:underline disabled:opacity-60"
            onClick={async () => {
              setState("sending");
              const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/app?email=potvrden" });
              setState(error ? "error" : "sent");
            }}
          >
            {state === "error" ? "Nije uspjelo — pokušaj ponovo" : "Pošalji ponovo"}
          </button>
        )}
      </p>
    </div>
  );
}
