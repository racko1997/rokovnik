"use client";

import { Check, Copy } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";
import { updateSettingsAction } from "./actions";

interface SalonSettings {
  name: string;
  slug: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  about: string;
  slotIntervalMin: number;
  minLeadMin: number;
  maxAdvanceDays: number;
}

const LEAD_OPTIONS = [
  [0, "Bez ograničenja"],
  [30, "30 minuta"],
  [60, "1 sat"],
  [120, "2 sata"],
  [240, "4 sata"],
  [720, "12 sati"],
  [1440, "Dan ranije"],
] as const;

export function SettingsForm({ salon, origin }: { salon: SalonSettings; origin: string }) {
  const [slug, setSlug] = useState(salon.slug);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const link = `${origin}/s/${salon.slug}`;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    start(async () => {
      const res = await updateSettingsAction({
        name: get("name"),
        slug,
        city: get("city"),
        address: get("address"),
        phone: get("phone"),
        email: get("email"),
        about: get("about"),
        slotIntervalMin: Number(get("slotIntervalMin")),
        minLeadMin: Number(get("minLeadMin")),
        maxAdvanceDays: Number(get("maxAdvanceDays")),
      });
      if (!res.ok) {
        setSaved(false);
        return setError(res.error);
      }
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form onSubmit={onSubmit} className="space-y-8">
        <section className="space-y-4 rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line">
          <h2 className="font-display text-xl">Salon</h2>
          <Field label="Naziv">
            <Input name="name" defaultValue={salon.name} required />
          </Field>
          <Field label="Adresa stranice za zakazivanje" hint="Mala slova, brojevi i crtice.">
            <div className="flex items-center rounded-[var(--radius-chip)] bg-porcelain ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-lacquer">
              <span className="pl-3 text-ink-faint">/s/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                className="h-11 flex-1 bg-transparent pr-3 focus:outline-none"
                required
              />
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Grad">
              <Input name="city" defaultValue={salon.city} />
            </Field>
            <Field label="Adresa">
              <Input name="address" defaultValue={salon.address} />
            </Field>
            <Field label="Telefon">
              <Input name="phone" type="tel" defaultValue={salon.phone} />
            </Field>
            <Field label="Email">
              <Input name="email" type="email" defaultValue={salon.email} />
            </Field>
          </div>
          <Field label="O salonu" hint="Kratak opis na stranici za zakazivanje.">
            <Textarea name="about" defaultValue={salon.about} rows={3} />
          </Field>
        </section>

        <section className="space-y-4 rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line">
          <h2 className="font-display text-xl">Online zakazivanje</h2>
          <p className="-mt-2 text-sm text-ink-soft">Važi za stranicu salona i, kasnije, za AI recepcionera.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Termini na svakih">
              <Select name="slotIntervalMin" defaultValue={salon.slotIntervalMin}>
                {[10, 15, 20, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Najkasnije prije termina">
              <Select name="minLeadMin" defaultValue={salon.minLeadMin}>
                {LEAD_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unaprijed najviše">
              <Select name="maxAdvanceDays" defaultValue={salon.maxAdvanceDays}>
                {[14, 30, 60, 90, 180].map((d) => (
                  <option key={d} value={d}>
                    {d} dana
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        <FormError message={error} />
        <Button type="submit" disabled={pending}>
          {saved ? (
            <>
              <Check size={18} /> Spremljeno
            </>
          ) : pending ? (
            "Spremam…"
          ) : (
            "Spremi promjene"
          )}
        </Button>
      </form>

      <aside className="h-fit rounded-[var(--radius-card)] bg-ink p-5 text-porcelain">
        <h2 className="font-display text-xl">Link za zakazivanje</h2>
        <p className="mt-1 text-sm text-porcelain/60">Stavite ga u Instagram bio, na Facebook stranicu i Google profil.</p>
        <p className="mt-4 rounded-lg bg-white/10 px-3 py-2.5 text-sm break-all">{link}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-porcelain px-4 text-sm font-medium text-ink hover:bg-white"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Kopirano" : "Kopiraj"}
          </button>
          <a href={`/s/${salon.slug}`} target="_blank" className="inline-flex h-9 items-center rounded-full px-4 text-sm text-porcelain/80 ring-1 ring-white/20 hover:text-white">
            Otvori
          </a>
        </div>
      </aside>
    </div>
  );
}
