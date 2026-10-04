"use client";

import { clsx } from "clsx";
import { Phone, Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea, Toggle } from "@/components/ui/field";
import { Swatch } from "@/components/ui/swatch";
import { formatDuration, formatPrice } from "@/lib/format";
import { saveServiceAction, setServiceActiveAction } from "./actions";

export interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  priceFrom: boolean;
  bookableOnline: boolean;
  active: boolean;
  staffIds: string[];
}

interface StaffLite {
  id: string;
  name: string;
  color: string;
}

export function ServicesBoard({
  services,
  staff,
  categories,
  currency,
}: {
  services: ServiceRow[];
  staff: StaffLite[];
  categories: string[];
  currency: string;
}) {
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const active = services.filter((s) => s.active);
  const archived = services.filter((s) => !s.active);
  const groups = useMemo(() => {
    const map = new Map<string, ServiceRow[]>();
    for (const s of active) {
      const key = s.categoryName ?? "Ostalo";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [active]);

  return (
    <>
      <PageHeader
        title="Usluge"
        description="Cjenovnik koji vide klijenti i koji koristi recepcioner pri zakazivanju."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={18} /> Nova usluga
          </Button>
        }
      />

      <div className="space-y-8 px-4 pb-10 sm:px-8">
        {groups.length === 0 && (
          <EmptyState onAdd={() => setEditing("new")} />
        )}

        {groups.map(([category, rows]) => (
          <section key={category}>
            <h2 className="mb-2 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">{category}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
              {rows.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 text-left transition-colors hover:bg-porcelain/70 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_8rem]"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="truncate">{s.name}</span>
                        {!s.bookableOnline && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-wash px-2 py-0.5 text-xs font-medium text-amber">
                            <Phone size={11} /> samo telefonom
                          </span>
                        )}
                      </span>
                      {s.description && <span className="block truncate text-sm text-ink-soft">{s.description}</span>}
                    </span>
                    <span className="tabular text-right font-medium sm:order-3">
                      {formatPrice(s.priceCents, currency, s.priceFrom)}
                    </span>
                    <span className="tabular text-sm text-ink-soft sm:order-2 sm:text-right">
                      {formatDuration(s.durationMin)}
                      {s.bufferMin > 0 && <span className="text-ink-faint"> +{s.bufferMin}</span>}
                    </span>
                    <span className="flex justify-end -space-x-1 sm:order-4">
                      {s.staffIds.length === 0 ? (
                        <span className="text-sm text-lacquer">Bez radnika</span>
                      ) : (
                        s.staffIds.map((id) => {
                          const st = staffById.get(id);
                          return st ? (
                            <span key={id} title={st.name}>
                              <Swatch color={st.color} size="sm" />
                            </span>
                          ) : null;
                        })
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {archived.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-ink-soft hover:text-ink">
              Arhivirane usluge ({archived.length})
            </summary>
            <ul className="mt-2 divide-y divide-line rounded-[var(--radius-card)] bg-paper/60 ring-1 ring-line">
              {archived.map((s) => (
                <ArchivedRow key={s.id} service={s} />
              ))}
            </ul>
          </details>
        )}
      </div>

      <ServiceSheet
        key={editing === "new" ? "new" : (editing?.id ?? "none")}
        service={editing}
        onClose={() => setEditing(null)}
        staff={staff}
        categories={categories}
      />
    </>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center">
      <p className="font-display text-2xl">Cjenovnik je prazan</p>
      <p className="mx-auto mt-2 max-w-sm text-ink-soft">
        Dodajte usluge koje radite, s trajanjem i cijenom. Na osnovu trajanja računamo slobodne termine.
      </p>
      <Button className="mt-5" onClick={onAdd}>
        <Plus size={18} /> Dodaj prvu uslugu
      </Button>
    </div>
  );
}

function ArchivedRow({ service }: { service: ServiceRow }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center justify-between px-4 py-3 text-ink-soft">
      <span>{service.name}</span>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => void (await setServiceActiveAction(service.id, true)))}
      >
        Vrati u cjenovnik
      </Button>
    </li>
  );
}

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180];

function ServiceSheet({
  service,
  onClose,
  staff,
  categories,
}: {
  service: ServiceRow | "new" | null;
  onClose: () => void;
  staff: StaffLite[];
  categories: string[];
}) {
  const existing = service && service !== "new" ? service : null;
  const [staffIds, setStaffIds] = useState<string[]>(existing?.staffIds ?? staff.map((s) => s.id));
  const [duration, setDuration] = useState(existing?.durationMin ?? 30);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveServiceAction(existing?.id ?? null, {
        name: String(f.get("name")),
        description: String(f.get("description") ?? ""),
        categoryName: String(f.get("categoryName") ?? ""),
        durationMin: duration,
        bufferMin: Number(f.get("bufferMin") || 0),
        price: Number(String(f.get("price")).replace(",", ".")),
        priceFrom: f.get("priceFrom") === "on",
        bookableOnline: f.get("bookableOnline") === "on",
        staffIds,
      });
      if (!res.ok) return setError(res.error);
      onClose();
    });
  }

  function archive() {
    if (!existing) return;
    start(async () => {
      const res = await setServiceActiveAction(existing.id, false);
      if (!res.ok) return setError(res.error);
      onClose();
    });
  }

  return (
    <Sheet
      open={service !== null}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? existing.name : "Nova usluga"}
      footer={
        <div className="flex items-center justify-between gap-3">
          {existing ? (
            <Button variant="ghost" onClick={archive} disabled={pending}>
              Arhiviraj
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" form="service-form" disabled={pending}>
            {pending ? "Spremam…" : existing ? "Spremi promjene" : "Dodaj uslugu"}
          </Button>
        </div>
      }
    >
      <form id="service-form" onSubmit={onSubmit} className="space-y-5">
        <Field label="Naziv">
          <Input name="name" defaultValue={existing?.name} required autoFocus={!existing} placeholder="npr. Žensko šišanje" />
        </Field>

        <Field label="Kategorija" hint="Grupiše usluge u cjenovniku. Upišite novu ili odaberite postojeću.">
          <Input name="categoryName" defaultValue={existing?.categoryName ?? ""} list="categories" placeholder="npr. Žene" />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Trajanje</legend>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                aria-pressed={duration === d}
                className={clsx(
                  "tabular h-9 rounded-full px-3 text-sm ring-1 transition-colors",
                  duration === d ? "bg-ink text-porcelain ring-ink" : "bg-paper text-ink-soft ring-line-strong hover:text-ink",
                )}
              >
                {formatDuration(d)}
              </button>
            ))}
            <Input
              type="number"
              min={5}
              max={600}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              aria-label="Trajanje u minutama"
              className="h-9 w-20 rounded-full text-center"
            />
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cijena (KM)">
            <Input
              name="price"
              inputMode="decimal"
              defaultValue={existing ? String(existing.priceCents / 100).replace(".", ",") : ""}
              required
              placeholder="30"
            />
          </Field>
          <Field label="Pauza nakon (min)" hint="Čišćenje, priprema.">
            <Input name="bufferMin" type="number" min={0} max={120} step={5} defaultValue={existing?.bufferMin ?? 0} />
          </Field>
        </div>

        <Toggle name="priceFrom" defaultChecked={existing?.priceFrom} label="Cijena „od“" description="Konačna cijena zavisi od dužine kose, količine boje i sl." />

        <Field label="Opis (nije obavezno)">
          <Textarea name="description" defaultValue={existing?.description ?? ""} rows={2} placeholder="Šta je uključeno" />
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Ko radi ovu uslugu</legend>
          {staff.length === 0 ? (
            <p className="text-sm text-ink-soft">Prvo dodajte radnike.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => {
                const on = staffIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStaffIds(on ? staffIds.filter((x) => x !== s.id) : [...staffIds, s.id])}
                    className={clsx(
                      "flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1.5 text-sm ring-1 transition-colors",
                      on ? "bg-ink text-porcelain ring-ink" : "bg-paper text-ink-soft ring-line-strong hover:text-ink",
                    )}
                  >
                    <Swatch color={s.color} size="sm" />
                    {s.name}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        <Toggle
          name="bookableOnline"
          defaultChecked={existing?.bookableOnline ?? true}
          label="Klijenti mogu sami zakazati"
          description="Isključite za usluge koje traže dogovor (npr. svečane frizure)."
        />

        <FormError message={error} />
      </form>
    </Sheet>
  );
}
