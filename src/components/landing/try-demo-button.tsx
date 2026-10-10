"use client";

import { useState, useTransition } from "react";
import { startSandboxAction } from "@/app/try-actions";
import { Button } from "@/components/ui/button";

/**
 * "Isprobaj bez registracije": jedan klik i posjetilac je u dashboardu svoje kopije
 * demo salona. Priprema traje par sekundi, pa dugme jasno kaže šta se dešava.
 */
export function TryDemoButton({
  variant = "primary",
  className,
  onDark = false,
}: {
  variant?: "primary" | "secondary";
  className?: string;
  /** Na tamnoj pozadini (završni poziv) — svijetli okvir umjesto standardnog */
  onDark?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={className}>
      <Button
        size="lg"
        variant={variant}
        disabled={pending}
        className={
          onDark && variant === "secondary"
            ? "w-full bg-transparent text-porcelain/90 ring-1 ring-white/25 hover:bg-white/5 hover:text-white hover:ring-white/50"
            : "w-full"
        }
        onClick={() =>
          start(async () => {
            setError(null);
            // Uspjeh preusmjerava u kalendar; vraća se samo greška
            const res = await startSandboxAction();
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Pripremam vaš salon…" : "Isprobaj bez registracije"}
      </Button>
      {error && <p className={`mt-2 text-sm ${onDark ? "text-porcelain/80" : "text-lacquer-deep"}`}>{error}</p>}
    </div>
  );
}
