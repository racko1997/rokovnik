"use client";

import { clsx } from "clsx";
import { UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import { Swatch } from "@/components/ui/swatch";
import { formatClock, formatDuration, formatLocalDateLong, formatPrice } from "@/lib/format";
import { createAppointmentAction } from "./actions";
import type { CalService, CalStaff } from "./types";

export interface Draft {
  staffId: string;
  date: string;
  startMin: number;
}

interface ClientHit {
  id: string;
  name: string;
  phone: string;
}

export function NewAppointmentSheet({
  draft,
  staff,
  services,
  currency,
  today,
  nowMin,
  onClose,
}: {
  draft: Draft | null;
  staff: CalStaff[];
  services: CalService[];
  currency: string;
  /** Današnji datum i sat u salonu — za upozorenje o terminu u prošlosti */
  today: string;
  nowMin: number;
  onClose: () => void;
}) {
  const [staffId, setStaffId] = useState(draft?.staffId ?? staff[0]?.id ?? "");
  const [date, setDate] = useState(draft?.date ?? "");
  const [startMin, setStartMin] = useState(draft?.startMin ?? 9 * 60);
  const [pickedServiceIds, setServiceIds] = useState<string[]>([]);
  const [clientQuery, setClientQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [client, setClient] = useState<ClientHit | null>(null);
  const [hitState, setHits] = useState<{ q: string; hits: ClientHit[] }>({ q: "", hits: [] });
  const [notes, setNotes] = useState("");
  const [slotState, setSlots] = useState<{ key: string; slots: number[] } | null>(null);
  const [confirmPast, setConfirmPast] = useState(false);
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);
  const [pending, start] = useTransition();

  const member = staff.find((s) => s.id === staffId);
  const offered = useMemo(() => services.filter((s) => s.staffIds.includes(staffId)), [services, staffId]);
  // Usluge koje odabrani radnik ne radi ne ulaze u termin
  const serviceIds = pickedServiceIds.filter((id) => offered.some((s) => s.id === id));
  const searching = !client && clientQuery.trim().length >= 2;
  const hits = searching && hitState.q === clientQuery ? hitState.hits : [];
  const slotsKey = serviceIds.length && date ? `${staffId}|${date}|${serviceIds.join(",")}` : null;
  const slots = slotState && slotState.key === slotsKey ? slotState.slots : null;
  const chosen = serviceIds.map((id) => services.find((s) => s.id === id)!).filter(Boolean);
  const duration = chosen.reduce((sum, s, i) => sum + s.durationMin + (i < chosen.length - 1 ? s.bufferMin : 0), 0);
  const price = chosen.reduce((sum, s) => sum + s.priceCents, 0);
  const priceFrom = chosen.some((s) => s.priceFrom);

  // Pretraga klijenata
  useEffect(() => {
    if (!searching) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/app/clients?q=${encodeURIComponent(clientQuery)}`, { signal: ctrl.signal }).catch(() => null);
      if (res?.ok) setHits({ q: clientQuery, hits: await res.json() });
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [clientQuery, searching]);

  // Slobodni termini za odabrane usluge
  useEffect(() => {
    if (!slotsKey) return;
    const [sid, d, ids] = slotsKey.split("|");
    const ctrl = new AbortController();
    const params = new URLSearchParams({ staffId: sid, date: d });
    ids.split(",").forEach((id) => params.append("serviceId", id));
    fetch(`/api/app/availability?${params}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((res: { slots: { startMin: number }[] }) => setSlots({ key: slotsKey, slots: res.slots.map((s) => s.startMin) }))
      .catch(() => {});
    return () => ctrl.abort();
  }, [slotsKey]);

  const suggestions = useMemo(() => {
    if (!slots) return [];
    // Najbliži slobodni termini oko odabranog vremena
    return [...slots].sort((a, b) => Math.abs(a - startMin) - Math.abs(b - startMin)).slice(0, 8).sort((a, b) => a - b);
  }, [slots, startMin]);
  const startIsFree = slots?.includes(startMin);

  // Greška važi samo za izbor na koji se odnosi — nestaje čim se nešto promijeni
  const formKey = [staffId, date, startMin, serviceIds.join(","), client?.id ?? clientQuery].join("|");
  const error = errorState?.key === formKey ? errorState.message : null;

  function submit() {
    start(async () => {
      const res = await createAppointmentAction({
        serviceIds,
        staffId,
        date,
        startMin,
        allowPast: inPast && confirmPast,
        clientId: client?.id,
        client: client ? undefined : { name: clientQuery, phone },
        notes,
      });
      if (!res.ok) return setErrorState({ key: formKey, message: res.error });
      onClose();
    });
  }

  const inPast = date < today || (date === today && startMin < nowMin - 5);
  const canSubmit = serviceIds.length > 0 && (client || clientQuery.trim().length >= 2) && !pending && (!inPast || confirmPast);

  return (
    <Sheet
      wide
      open={draft !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Novi termin"
      description={date ? `${formatLocalDateLong(date)} u ${formatClock(startMin)}` : undefined}
      footer={
        <div className="space-y-3">
          <FormError message={error} />
          <div className="flex items-center justify-between gap-3">
            <span className="tabular text-sm text-ink-soft">
              {chosen.length > 0 && (
                <>
                  {formatClock(startMin)}–{formatClock(startMin + duration)} · {formatPrice(price, currency, priceFrom)}
                </>
              )}
            </span>
            <Button onClick={submit} disabled={!canSubmit}>
              {pending ? "Upisujem…" : "Upiši termin"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Klijent */}
        <section>
          <h3 className="mb-2 text-sm font-medium">Klijent</h3>
          {client ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-chip)] bg-porcelain px-3 py-2.5 ring-1 ring-line">
              <UserRound size={18} className="text-ink-soft" />
              <span className="flex-1">
                <span className="block font-medium">{client.name}</span>
                <span className="tabular block text-sm text-ink-soft">{client.phone}</span>
              </span>
              <button type="button" onClick={() => setClient(null)} className="rounded p-1 text-ink-soft hover:text-ink" aria-label="Promijeni klijenta">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  placeholder="Ime ili broj telefona"
                  autoFocus
                  aria-label="Ime klijenta"
                />
                {hits.length > 0 && (
                  <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-[var(--radius-chip)] bg-paper shadow-[var(--shadow-pop)] ring-1 ring-line">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          onClick={() => setClient(h)}
                          className="flex w-full justify-between px-3 py-2.5 text-left hover:bg-porcelain"
                        >
                          <span className="font-medium">{h.name}</span>
                          <span className="tabular text-sm text-ink-soft">{h.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {clientQuery.trim().length >= 2 && (
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Telefon novog klijenta (preporučeno)" aria-label="Telefon" />
              )}
            </div>
          )}
        </section>

        {/* Radnik */}
        <section>
          <h3 className="mb-2 text-sm font-medium">Radnik</h3>
          <div className="flex flex-wrap gap-2">
            {staff.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === staffId}
                onClick={() => setStaffId(s.id)}
                className={clsx(
                  "flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1.5 text-sm ring-1 transition-colors",
                  s.id === staffId ? "bg-ink text-porcelain ring-ink" : "bg-paper text-ink-soft ring-line-strong hover:text-ink",
                )}
              >
                <Swatch color={s.color} size="sm" />
                {s.name}
              </button>
            ))}
          </div>
        </section>

        {/* Usluge */}
        <section>
          <h3 className="mb-2 text-sm font-medium">Usluge {member && <span className="font-normal text-ink-soft">koje radi {member.name}</span>}</h3>
          {offered.length === 0 ? (
            <p className="text-sm text-ink-soft">Ovaj radnik nema dodijeljenih usluga.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {offered.map((s) => {
                const on = serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setServiceIds(on ? serviceIds.filter((x) => x !== s.id) : [...serviceIds, s.id])}
                    className={clsx(
                      "rounded-full px-3 py-1.5 text-sm ring-1 transition-colors",
                      on ? "bg-ink text-porcelain ring-ink" : "bg-paper text-ink-soft ring-line-strong hover:text-ink",
                    )}
                  >
                    {s.name} <span className={on ? "text-porcelain/60" : "text-ink-faint"}>{formatDuration(s.durationMin)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Vrijeme */}
        <section>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Vrijeme">
              <Input
                type="time"
                step={300}
                value={formatClock(startMin)}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  if (!Number.isNaN(h)) setStartMin(h * 60 + (m || 0));
                }}
              />
            </Field>
          </div>
          {slots && (
            <div className="mt-3">
              {slots.length === 0 ? (
                <p className="text-sm text-amber">Nema slobodnog termina u radnom vremenu ovog dana. Možete upisati i prekovremeni termin.</p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-ink-soft">
                    {startIsFree ? "Termin je slobodan. Najbliži drugi:" : "Odabrano vrijeme nije slobodno u radnom vremenu. Slobodno:"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setStartMin(m)}
                        className={clsx(
                          "tabular rounded-full px-3 py-1 text-sm ring-1",
                          m === startMin ? "bg-mint text-white ring-mint" : "bg-mint-wash text-mint ring-mint/20 hover:ring-mint/50",
                        )}
                      >
                        {formatClock(m)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {inPast && (
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-chip)] bg-amber-wash/70 p-3 text-sm ring-1 ring-amber/25">
            <input type="checkbox" checked={confirmPast} onChange={(e) => setConfirmPast(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--amber)]" />
            <span>
              <span className="block font-medium text-amber">Ovo vrijeme je već prošlo</span>
              <span className="block text-ink-soft">Označite ako naknadno upisujete posjetu koja je već bila (npr. klijent bez najave).</span>
            </span>
          </label>
        )}

        <Field label="Napomena (nije obavezno)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="npr. alergija na amonijak" />
        </Field>
      </div>
    </Sheet>
  );
}
