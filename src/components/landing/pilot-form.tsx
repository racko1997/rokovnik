"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { submitPilotLeadAction } from "@/app/pilot-actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/field";

export function PilotForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    start(async () => {
      const res = await submitPilotLeadAction({
        salonName: get("salonName"),
        city: get("city"),
        contactName: get("contactName"),
        phone: get("phone"),
        email: get("email"),
        salonType: get("salonType"),
        staffCount: get("staffCount"),
        message: get("message"),
        website: get("website"),
      });
      if (!res.ok) return setError(res.error);
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] bg-mint-wash/60 p-6 ring-1 ring-mint/20">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-white">
          <Check size={20} />
        </span>
        <p className="font-display text-2xl">Hvala, prijava je stigla</p>
        <p className="text-ink-soft">Javićemo vam se telefonom da dogovorimo postavljanje. Ako ne želite čekati, salon možete postaviti i sami — traje par minuta.</p>
        <ButtonLink href="/registracija" className="mt-1">
          Postavi salon odmah
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Naziv salona">
          <Input name="salonName" required placeholder="npr. Studio Lana" />
        </Field>
        <Field label="Grad">
          <Input name="city" placeholder="Sarajevo" />
        </Field>
        <Field label="Vaše ime">
          <Input name="contactName" required autoComplete="name" />
        </Field>
        <Field label="Telefon">
          <Input name="phone" type="tel" required autoComplete="tel" placeholder="061 234 567" />
        </Field>
        <Field label="Tip salona">
          <Select name="salonType" defaultValue="">
            <option value="">Odaberite…</option>
            <option>Frizerski — žene</option>
            <option>Barber</option>
            <option>Frizerski — uniseks</option>
            <option>Kozmetički salon</option>
            <option>Nokti</option>
            <option>Drugo</option>
          </Select>
        </Field>
        <Field label="Broj radnika">
          <Select name="staffCount" defaultValue="">
            <option value="">Odaberite…</option>
            <option>Radim sam/a</option>
            <option>2–3</option>
            <option>4–6</option>
            <option>7 i više</option>
          </Select>
        </Field>
      </div>
      <Field label="Email (nije obavezno)">
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Field label="Kako sada zakazujete termine? (nije obavezno)">
        <Textarea name="message" rows={2} placeholder="npr. telefonom i preko Instagrama, sveska na recepciji…" />
      </Field>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Šaljem…" : "Prijavi salon"}
      </Button>
    </form>
  );
}
