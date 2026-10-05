"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { slugify } from "@/lib/slug";
import { createSalonAction } from "./actions";

export function NewSalonForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createSalonAction({
        name,
        city: String(form.get("city") ?? ""),
        phone: String(form.get("phone") ?? ""),
      });
      if (!res.ok) return setError(res.error);
      router.push("/app/postavljanje");
      router.refresh();
    });
  }

  const slug = slugify(name);

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <Field
        label="Naziv salona"
        hint={
          slug ? (
            <>
              Stranica za online zakazivanje: <span className="font-medium text-ink">/s/{slug}</span>
            </>
          ) : (
            "Ovo vide klijenti."
          )
        }
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="npr. Studio Lana" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Grad">
          <Input name="city" placeholder="Sarajevo" autoComplete="address-level2" />
        </Field>
        <Field label="Telefon salona">
          <Input name="phone" type="tel" placeholder="061 234 567" autoComplete="tel" />
        </Field>
      </div>
      <FormError message={error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending || name.trim().length < 2}>
        {pending ? "Otvaram salon…" : "Otvori salon"}
      </Button>
    </form>
  );
}
