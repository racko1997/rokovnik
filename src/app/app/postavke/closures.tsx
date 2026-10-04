"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { formatLocalDateLong, plural } from "@/lib/format";
import { addClosureAction, removeClosureAction } from "./actions";

interface Closure {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

/** Neradni dani cijelog salona: praznici, kolektivni odmor. */
export function Closures({ closures, today }: { closures: Closure[]; today: string }) {
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<number | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const startDate = String(f.get("startDate"));
    start(async () => {
      const res = await addClosureAction({
        startDate,
        endDate: String(f.get("endDate") || startDate),
        reason: String(f.get("reason") ?? ""),
      });
      if (!res.ok) return setError(res.error);
      setError(null);
      setConflicts(res.data.conflicts);
      form.reset();
    });
  }

  return (
    <section className="space-y-4 rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line">
      <div>
        <h2 className="font-display text-xl">Neradni dani salona</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Praznici i kolektivni odmor važe za sve radnike — ti dani se ne nude za zakazivanje. Ako neko ipak radi, dodajte mu izmjenu u
          Smjenama.
        </p>
      </div>

      {closures.length > 0 && (
        <ul className="divide-y divide-line rounded-[var(--radius-chip)] ring-1 ring-line">
          {closures.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span>
                <span className="font-medium first-letter:uppercase">
                  {formatLocalDateLong(c.startDate)}
                  {c.endDate !== c.startDate && ` – ${formatLocalDateLong(c.endDate)}`}
                </span>
                {c.reason && <span className="text-ink-soft"> · {c.reason}</span>}
              </span>
              <button
                type="button"
                aria-label="Ukloni neradni dan"
                disabled={pending}
                onClick={() => start(async () => void (await removeClosureAction(c.id)))}
                className="rounded p-1.5 text-ink-faint hover:text-lacquer"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
        <Field label="Od">
          <Input name="startDate" type="date" min={today} required className="h-10" />
        </Field>
        <Field label="Do (uključivo)">
          <Input name="endDate" type="date" min={today} className="h-10" />
        </Field>
        <Field label="Naziv">
          <Input name="reason" placeholder="npr. Ramazanski bajram" className="h-10" />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending} className="h-10">
          Dodaj
        </Button>
      </form>
      <FormError message={error} />
      {conflicts !== null && conflicts > 0 && (
        <p className="rounded-[var(--radius-chip)] bg-lacquer-wash px-3 py-2.5 text-sm text-lacquer-deep">
          U te dane već {plural(conflicts, "postoji", "postoje", "postoji")} {conflicts} {plural(conflicts, "termin", "termina", "termina")}.{" "}
          <Link href="/app/radnici/smjene" className="font-medium underline underline-offset-2">
            Riješite ih u Smjenama
          </Link>
          .
        </p>
      )}
      {conflicts === 0 && <p className="text-sm text-mint">✓ Dodano. Nijedan postojeći termin nije pogođen.</p>}
    </section>
  );
}
