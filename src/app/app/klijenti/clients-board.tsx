"use client";

import { clsx } from "clsx";
import { Phone, Plus, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { formatInstant, formatPrice, plural } from "@/lib/format";
import { clientHistoryAction, saveClientAction } from "./actions";

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  phoneDisplay: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  visits: number;
  noShows: number;
  lastVisit: string | null;
  nextVisit: string | null;
  spentCents: number;
}

interface Visit {
  appointmentId: string;
  startsAt: string;
  status: string;
  source: string;
  services: string[];
  staff: string[];
  /** null kad korisnik nema pravo vidjeti cijene */
  priceCents: number | null;
  notes: string | null;
}

const STATUS: Record<string, { label: string; tone: string }> = {
  booked: { label: "Zakazano", tone: "bg-porcelain text-ink-soft ring-1 ring-line" },
  confirmed: { label: "Potvrđeno", tone: "bg-mint-wash text-mint" },
  completed: { label: "Završeno", tone: "bg-ink/5 text-ink-soft" },
  cancelled: { label: "Otkazano", tone: "bg-lacquer-wash text-lacquer-deep" },
  no_show: { label: "Nije došao/la", tone: "bg-amber-wash text-amber" },
};

const SOURCE: Record<string, string> = {
  dashboard: "recepcija",
  online: "online",
  chat: "AI chat",
  instagram: "Instagram",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  viber: "Viber",
  voice: "poziv",
};

export function ClientsBoard({
  q,
  sort,
  page,
  pageSize,
  total,
  currency,
  timezone,
  showRevenue,
  clients,
}: {
  q: string;
  sort: string;
  page: number;
  pageSize: number;
  total: number;
  currency: string;
  timezone: string;
  showRevenue: boolean;
  clients: ClientRow[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(q);
  const [open, setOpen] = useState<ClientRow | "new" | null>(null);

  // Godina se ispisuje samo za datume iz druge godine (kao u kalendaru telefona)
  const thisYear = formatInstant(new Date(), timezone, { year: true }).slice(-4);
  const date = (iso: string | null, withTime = false) =>
    iso ? formatInstant(iso, timezone, { time: withTime, year: formatInstant(iso, timezone, { year: true }).slice(-4) !== thisYear }) : "—";

  // Pretraga dok kucate (s malim zakašnjenjem)
  useEffect(() => {
    if (query === q) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (query.trim()) p.set("q", query.trim());
      else p.delete("q");
      p.delete("p");
      router.replace(`?${p.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [query, q, params, router]);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Klijenti"
        description={`${total} ${plural(total, "klijent", "klijenta", "klijenata")} — sa historijom posjeta, napomenama i nedolascima.`}
        actions={
          <Button onClick={() => setOpen("new")}>
            <Plus size={18} /> Novi klijent
          </Button>
        }
      />

      <div className="space-y-4 px-4 pb-10 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-64 flex-1 sm:max-w-sm">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ime ili broj telefona" className="pl-9" aria-label="Pretraga klijenata" />
          </label>
          <div className="flex rounded-full bg-paper p-0.5 text-sm ring-1 ring-line-strong">
            {[
              ["recent", "Nedavni"],
              ["visits", "Najvjerniji"],
              ["name", "Po imenu"],
            ].map(([v, label]) => (
              <Link
                key={v}
                href={href({ sort: v === "recent" ? null : v, p: null })}
                className={clsx("rounded-full px-3 py-1.5 font-medium", sort === v ? "bg-ink text-porcelain" : "text-ink-soft hover:text-ink")}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="font-display text-2xl">{q ? "Nema klijenata za tu pretragu" : "Još nema klijenata"}</p>
            <p className="mx-auto mt-2 max-w-sm text-ink-soft">
              {q ? "Probajte drugo ime ili dio broja telefona." : "Klijenti se dodaju sami kad zakažu termin — online, preko AI recepcionera ili kod vas."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
            <table className="w-full text-left text-sm">
              <thead className="hidden border-b border-line text-xs font-medium tracking-wide text-ink-faint uppercase md:table-header-group">
                <tr>
                  <th className="px-4 py-2.5">Klijent</th>
                  <th className="px-3 py-2.5 text-right">Posjete</th>
                  <th className="px-3 py-2.5">Zadnja posjeta</th>
                  <th className="px-3 py-2.5">Sljedeći termin</th>
                  {showRevenue && <th className="px-4 py-2.5 text-right">Potrošeno</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clients.map((c) => (
                  <tr key={c.id} onClick={() => setOpen(c)} className="cursor-pointer transition-colors hover:bg-porcelain/60">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-medium">
                        {c.name}
                        {c.visits === 0 && !c.nextVisit && <span className="text-xs font-normal text-ink-faint">bez posjeta</span>}
                        {c.noShows > 0 && (
                          <span className="rounded-full bg-amber-wash px-1.5 py-px text-[0.6875rem] font-semibold text-amber" title="Nije došao/la">
                            {c.noShows}× nije došao/la
                          </span>
                        )}
                      </span>
                      <span className="tabular block text-ink-soft">{c.phoneDisplay || c.email || "—"}</span>
                      <span className="mt-1 block text-xs text-ink-soft md:hidden">
                        {c.visits} {plural(c.visits, "posjeta", "posjete", "posjeta")} · zadnja {date(c.lastVisit)}
                        {c.nextVisit && <> · sljedeći {date(c.nextVisit)}</>}
                      </span>
                    </td>
                    <td className="tabular hidden px-3 py-3 text-right md:table-cell">{c.visits}</td>
                    <td className="tabular hidden px-3 py-3 text-ink-soft md:table-cell">{date(c.lastVisit)}</td>
                    <td className="tabular hidden px-3 py-3 md:table-cell">{c.nextVisit ? <span className="font-medium text-mint">{date(c.nextVisit, true)}</span> : <span className="text-ink-faint">—</span>}</td>
                    {showRevenue && <td className="tabular hidden px-4 py-3 text-right md:table-cell">{c.spentCents ? formatPrice(c.spentCents, currency) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <div className="flex items-center justify-between text-sm text-ink-soft">
            <span>
              {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} od {total}
            </span>
            <span className="flex gap-2">
              {page > 0 && (
                <Link href={href({ p: page > 1 ? String(page - 1) : null })} className="rounded-full px-3 py-1.5 ring-1 ring-line-strong hover:text-ink">
                  Prethodni
                </Link>
              )}
              {(page + 1) * pageSize < total && (
                <Link href={href({ p: String(page + 1) })} className="rounded-full px-3 py-1.5 ring-1 ring-line-strong hover:text-ink">
                  Sljedeći
                </Link>
              )}
            </span>
          </div>
        )}
      </div>

      <ClientSheet key={open === "new" ? "new" : (open?.id ?? "none")} client={open} currency={currency} date={date} onClose={() => setOpen(null)} />
    </>
  );
}

function ClientSheet({
  client,
  currency,
  date,
  onClose,
}: {
  client: ClientRow | "new" | null;
  currency: string;
  date: (iso: string | null, withTime?: boolean) => string;
  onClose: () => void;
}) {
  const existing = client && client !== "new" ? client : null;
  const [history, setHistory] = useState<Visit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!existing) return;
    let alive = true;
    clientHistoryAction(existing.id).then((res) => alive && res.ok && setHistory(res.data));
    return () => {
      alive = false;
    };
  }, [existing]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveClientAction(existing?.id ?? null, {
        name: String(f.get("name")),
        phone: String(f.get("phone") ?? ""),
        email: String(f.get("email") ?? ""),
        notes: String(f.get("notes") ?? ""),
      });
      if (!res.ok) return setError(res.error);
      onClose();
    });
  }

  const upcoming = history?.filter((v) => new Date(v.startsAt) >= new Date() && (v.status === "booked" || v.status === "confirmed")) ?? [];
  const past = history?.filter((v) => !upcoming.includes(v)) ?? [];

  return (
    <Sheet
      wide
      open={client !== null}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? existing.name : "Novi klijent"}
      description={
        existing
          ? `${existing.visits} ${plural(existing.visits, "posjeta", "posjete", "posjeta")}${existing.noShows ? ` · ${existing.noShows}× nije došao/la` : ""} · klijent od ${date(existing.createdAt)}`
          : undefined
      }
      footer={
        <div className="flex justify-end">
          <Button type="submit" form="client-form" disabled={pending}>
            {pending ? "Spremam…" : existing ? "Spremi promjene" : "Dodaj klijenta"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {existing?.phone && (
          <a href={`tel:${existing.phone}`} className="flex items-center gap-3 rounded-[var(--radius-chip)] bg-porcelain px-3 py-2.5 ring-1 ring-line hover:ring-line-strong">
            <Phone size={16} className="text-ink-soft" />
            <span className="tabular font-medium">{existing.phoneDisplay}</span>
            <span className="ml-auto text-sm text-ink-soft">Pozovi</span>
          </a>
        )}

        <form id="client-form" onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ime i prezime">
              <Input name="name" defaultValue={existing?.name} required autoFocus={!existing} />
            </Field>
            <Field label="Telefon">
              <Input name="phone" type="tel" defaultValue={existing?.phoneDisplay ?? ""} placeholder="061 234 567" />
            </Field>
          </div>
          <Field label="Email (nije obavezno)">
            <Input name="email" type="email" defaultValue={existing?.email ?? ""} />
          </Field>
          <Field label="Napomene" hint="Vidi ih osoblje pri svakom terminu — npr. alergije, omiljena boja, dužina kose.">
            <Textarea name="notes" defaultValue={existing?.notes ?? ""} rows={3} placeholder="npr. alergija na amonijak; boja 7.1 + 6%" />
          </Field>
          <FormError message={error} />
        </form>

        {existing && (
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">Termini</h3>
            {history === null ? (
              <p className="text-sm text-ink-soft">Učitavam…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-ink-soft">Nema termina.</p>
            ) : (
              <ul className="divide-y divide-line rounded-[var(--radius-chip)] ring-1 ring-line">
                {[...upcoming.reverse(), ...past].map((v) => {
                  const st = STATUS[v.status];
                  const future = upcoming.includes(v);
                  return (
                    <li key={v.appointmentId} className={clsx("px-3 py-2.5 text-sm", future && "bg-mint-wash/40")}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="tabular font-medium">{date(v.startsAt, true)}</span>
                        <span className={clsx("rounded-full px-2 py-px text-[0.6875rem] font-medium", st.tone)}>{st.label}</span>
                        <span className="text-xs text-ink-faint">{SOURCE[v.source]}</span>
                        {v.priceCents !== null && v.priceCents > 0 && <span className="tabular ml-auto text-ink-soft">{formatPrice(v.priceCents, currency)}</span>}
                      </div>
                      <p className="mt-0.5 text-ink-soft">
                        {v.services.join(" + ")} · {v.staff.join(", ")}
                      </p>
                      {v.notes && <p className="mt-0.5 text-xs text-ink-faint">„{v.notes}“</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            {existing.visits === 0 && history && history.length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-amber">
                <Sparkles size={12} /> Prva posjeta tek predstoji
              </p>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
}
