"use client";

import { useTransition } from "react";
import { setLeadStatusAction } from "./actions";

const LABEL = { novo: "Novo", kontaktiran: "Kontaktiran", pilot: "U pilotu", odbijeno: "Odbijeno" } as const;

export function LeadStatus({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => start(async () => void (await setLeadStatusAction(id, e.target.value as keyof typeof LABEL)))}
      className="h-9 rounded-full bg-paper px-3 text-sm ring-1 ring-line-strong"
      aria-label="Status prijave"
    >
      {Object.entries(LABEL).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
