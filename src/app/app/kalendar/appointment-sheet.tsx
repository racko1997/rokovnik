"use client";

import { clsx } from "clsx";
import { Phone } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Swatch } from "@/components/ui/swatch";
import { formatClock, formatDuration, formatPrice } from "@/lib/format";
import { setAppointmentStatusAction } from "./actions";
import { SOURCE_LABEL, STATUS_LABEL, type CalBlock, type CalStaff, type Status } from "./types";

const STATUS_TONE: Record<Status, string> = {
  booked: "bg-porcelain text-ink-soft ring-line-strong",
  confirmed: "bg-mint-wash text-mint ring-mint/25",
  completed: "bg-ink text-porcelain ring-ink",
  cancelled: "bg-lacquer-wash text-lacquer-deep ring-lacquer/25",
  no_show: "bg-amber-wash text-amber ring-amber/25",
};

export function AppointmentSheet({
  block,
  staff,
  currency,
  showPrices = true,
  onClose,
}: {
  block: CalBlock | null;
  staff: CalStaff[];
  currency: string;
  showPrices?: boolean;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, start] = useTransition();

  const member = staff.find((s) => s.id === block?.staffId);
  const total = block?.services.reduce((sum, s) => sum + s.priceCents, 0) ?? 0;

  function setStatus(status: Status) {
    if (!block) return;
    start(async () => {
      const res = await setAppointmentStatusAction(block.appointmentId, status);
      if (!res.ok) return setError(res.error);
      close();
    });
  }

  function close() {
    setError(null);
    setConfirmCancel(false);
    onClose();
  }

  return (
    <Sheet
      open={block !== null}
      onOpenChange={(o) => !o && close()}
      title={block?.client?.name ?? "Termin"}
      description={block ? `${formatClock(block.startMin)}–${formatClock(block.endMin)} · ${formatDuration(block.endMin - block.startMin)}` : undefined}
      footer={
        block && (
          <div className="space-y-3">
            <FormError message={error} />
            {confirmCancel ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Otkazati ovaj termin?</span>
                <span className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmCancel(false)} disabled={pending}>
                    Ne
                  </Button>
                  <Button variant="danger" onClick={() => setStatus("cancelled")} disabled={pending}>
                    Da, otkaži
                  </Button>
                </span>
              </div>
            ) : block.status === "cancelled" ? (
              <Button variant="secondary" className="w-full" onClick={() => setStatus("booked")} disabled={pending}>
                Vrati termin
              </Button>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)} disabled={pending}>
                  Otkaži
                </Button>
                <span className="flex flex-wrap gap-2">
                  {block.status !== "no_show" && block.status !== "completed" && (
                    <Button variant="ghost" size="sm" onClick={() => setStatus("no_show")} disabled={pending}>
                      Nije došao/la
                    </Button>
                  )}
                  {block.status === "booked" && (
                    <Button variant="secondary" size="sm" onClick={() => setStatus("confirmed")} disabled={pending}>
                      Potvrdi
                    </Button>
                  )}
                  {block.status !== "completed" ? (
                    <Button size="sm" onClick={() => setStatus("completed")} disabled={pending}>
                      Završeno
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setStatus("booked")} disabled={pending}>
                      Vrati na zakazano
                    </Button>
                  )}
                </span>
              </div>
            )}
          </div>
        )
      }
    >
      {block && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx("rounded-full px-2.5 py-1 text-xs font-medium ring-1", STATUS_TONE[block.status])}>
              {STATUS_LABEL[block.status]}
            </span>
            <span className="rounded-full bg-porcelain px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-line">
              {SOURCE_LABEL[block.source] ? `Zakazano: ${SOURCE_LABEL[block.source]}` : "Upisala recepcija"}
            </span>
          </div>

          {block.client?.phone && (
            <a
              href={`tel:${block.client.phone}`}
              className="flex items-center gap-3 rounded-[var(--radius-chip)] bg-porcelain px-3 py-2.5 ring-1 ring-line hover:ring-line-strong"
            >
              <Phone size={16} className="text-ink-soft" />
              <span className="tabular font-medium">{block.client.phone}</span>
              <span className="ml-auto text-sm text-ink-soft">Pozovi</span>
            </a>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">Usluge</h3>
            <ul className="divide-y divide-line">
              {block.services.map((s, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span>{s.name}</span>
                  {showPrices && <span className="tabular text-ink-soft">{formatPrice(s.priceCents, currency)}</span>}
                </li>
              ))}
              {showPrices && block.services.length > 1 && (
                <li className="flex justify-between py-2 font-medium">
                  <span>Ukupno</span>
                  <span className="tabular">{formatPrice(total, currency)}</span>
                </li>
              )}
            </ul>
          </section>

          {member && (
            <section className="flex items-center gap-3">
              <Swatch color={member.color} />
              <span>
                <span className="block font-medium">{member.name}</span>
                <span className="block text-sm text-ink-soft">{member.title}</span>
              </span>
            </section>
          )}

          {block.notes && (
            <section>
              <h3 className="mb-1 text-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">Napomena</h3>
              <p className="whitespace-pre-line text-ink-soft">{block.notes}</p>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
