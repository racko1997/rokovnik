"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { formatClock, formatLocalDateLong } from "@/lib/format";
import { type Day, TimePicker, WINDOW } from "../../s/[slug]/booking-flow";
import { cancelByLinkAction, rescheduleByLinkAction } from "./actions";

/** Otkazivanje i pomjeranje termina preko linka iz potvrde. */
export function ManagePanel({
  token,
  slug,
  today,
  serviceIds,
  staffId,
}: {
  token: string;
  slug: string;
  today: string;
  serviceIds: string[];
  staffId: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "move" | "cancel">("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Slobodni termini za iste usluge kod istog radnika
  const [from, setFrom] = useState(today);
  const [loaded, setLoaded] = useState<{ key: string; days: Day[] | null; error: string | null } | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [startMin, setStartMin] = useState<number | null>(null);
  const loadKey = mode === "move" ? from : null;
  const days = loaded && loaded.key === loadKey ? loaded.days : null;
  const servicesKey = serviceIds.join(",");

  useEffect(() => {
    if (!loadKey) return;
    const ctrl = new AbortController();
    const p = new URLSearchParams({ from: loadKey, days: String(WINDOW) });
    servicesKey.split(",").forEach((id) => p.append("serviceId", id));
    if (staffId) p.set("staffId", staffId);
    fetch(`/api/public/${slug}/availability?${p}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Greška");
        return body as { days: Day[] };
      })
      .then((d) => {
        setLoaded({ key: loadKey, days: d.days, error: null });
        setDate((cur) => (cur && d.days.some((x) => x.date === cur && x.slots.length) ? cur : (d.days.find((x) => x.slots.length)?.date ?? null)));
      })
      .catch((e) => e.name !== "AbortError" && setLoaded({ key: loadKey, days: null, error: e.message }));
    return () => ctrl.abort();
  }, [loadKey, slug, servicesKey, staffId]);

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, message: string) =>
    start(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Nije uspjelo.");
        return;
      }
      setDone(message);
      setMode("idle");
      setStartMin(null);
      router.refresh();
    });

  return (
    <div className="mt-6 space-y-4">
      {done && <p className="rounded-[var(--radius-card)] bg-mint-wash px-4 py-3 font-medium text-mint">{done}</p>}
      {mode === "idle" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => {
              setDone(null);
              setMode("move");
            }}
          >
            Pomjeri termin
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => {
              setDone(null);
              setMode("cancel");
            }}
          >
            Otkaži termin
          </Button>
        </div>
      )}

      {mode === "cancel" && (
        <div className="rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line">
          <p className="font-medium">Sigurno otkazujete termin?</p>
          <p className="mt-1 text-sm text-ink-soft">Salon dobija obavijest, a vrijeme postaje slobodno za druge.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              className="w-full"
              disabled={pending}
              onClick={() => run(() => cancelByLinkAction(token), "Termin je otkazan. Hvala što ste javili na vrijeme.")}
            >
              {pending ? "Otkazujem…" : "Da, otkaži"}
            </Button>
            <Button size="lg" variant="secondary" className="w-full" disabled={pending} onClick={() => setMode("idle")}>
              Ne, ostavi
            </Button>
          </div>
        </div>
      )}

      {mode === "move" && (
        <div className="rounded-[var(--radius-card)] bg-paper p-5 ring-1 ring-line">
          <p className="mb-4 font-medium">Odaberite novo vrijeme</p>
          <TimePicker
            today={today}
            from={from}
            onFrom={setFrom}
            days={days}
            error={loaded && loaded.key === loadKey ? loaded.error : null}
            date={date}
            onDate={(d) => {
              setDate(d);
              setStartMin(null);
            }}
            startMin={startMin}
            onPick={setStartMin}
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              className="w-full"
              disabled={pending || !date || startMin === null}
              onClick={() => {
                if (!date || startMin === null) return;
                run(() => rescheduleByLinkAction(token, { date, startMin }), `Termin je pomjeren na ${formatLocalDateLong(date)} u ${formatClock(startMin)}.`);
              }}
            >
              {pending ? "Pomjeram…" : startMin !== null ? `Pomjeri na ${formatClock(startMin)}` : "Odaberite vrijeme"}
            </Button>
            <Button size="lg" variant="secondary" className="w-full" disabled={pending} onClick={() => setMode("idle")}>
              Odustani
            </Button>
          </div>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}
