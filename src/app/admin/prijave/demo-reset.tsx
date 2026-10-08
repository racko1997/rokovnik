"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resetDemoSalonAction } from "./actions";

/** Obnova demo salona (npr. na novoj bazi ili kad termini zastare). */
export function DemoReset() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await resetDemoSalonAction();
            setMsg(res.ok ? "Demo salon je obnovljen." : res.error);
          })
        }
      >
        {pending ? "Obnavljam…" : "Obnovi demo salon"}
      </Button>
      {msg && <span className="text-sm text-ink-soft">{msg}</span>}
    </div>
  );
}
