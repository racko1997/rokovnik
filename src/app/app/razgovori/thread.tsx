import { clsx } from "clsx";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

interface ThreadMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName: string | null;
  toolArgs: unknown;
  toolResult: unknown;
  time: string;
}

const TOOL_LABEL: Record<string, string> = {
  find_available_slots: "Provjerio slobodne termine",
  book_appointment: "Upisao termin",
  find_client_appointments: "Potražio termine klijenta",
  cancel_appointment: "Otkazao termin",
  handoff_to_staff: "Prebacio razgovor osoblju",
};

function toolSummary(m: ThreadMessage): { text: string; tone: "ok" | "error" | "neutral" } {
  const result = (m.toolResult ?? {}) as Record<string, unknown>;
  const args = (m.toolArgs ?? {}) as Record<string, unknown>;
  if (typeof result.error === "string") return { text: `${TOOL_LABEL[m.toolName ?? ""] ?? m.toolName} — greška: ${result.error}`, tone: "error" };
  switch (m.toolName) {
    case "find_available_slots": {
      const days = (result.days as { date: string; slots: unknown[] }[] | undefined) ?? [];
      const total = days.reduce((n, d) => n + d.slots.length, 0);
      return { text: `${TOOL_LABEL[m.toolName]} od ${args.date_from} (${args.days} d) — ${total ? `${total} slobodnih` : "nema slobodnih"}`, tone: "neutral" };
    }
    case "book_appointment":
      return { text: `${TOOL_LABEL[m.toolName]}: ${result.date} u ${result.start}${result.staff ? `, kod: ${result.staff}` : ""}`, tone: "ok" };
    case "handoff_to_staff":
      return { text: `${TOOL_LABEL[m.toolName]}: ${args.reason}`, tone: "error" };
    default:
      return { text: TOOL_LABEL[m.toolName ?? ""] ?? m.toolName ?? "Alat", tone: m.toolName === "cancel_appointment" ? "ok" : "neutral" };
  }
}

export function ConversationThread({
  channel,
  status,
  handoffReason,
  messages,
}: {
  channel: string;
  status: "open" | "handoff" | "closed";
  handoffReason: string | null;
  messages: ThreadMessage[];
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm sm:px-6">
        <Link href="?c=" className="-ml-2 rounded-full p-1.5 text-ink-soft hover:text-ink md:hidden" aria-label="Nazad na listu">
          <ChevronLeft size={18} />
        </Link>
        <span className="text-ink-soft">{channel}</span>
        {status === "handoff" && (
          <span className="rounded-full bg-amber-wash px-2.5 py-0.5 font-medium text-amber">Treba odgovor: {handoffReason}</span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.map((m) => {
          if (m.role === "tool") {
            const s = toolSummary(m);
            return (
              <details key={m.id} className="group mx-auto max-w-xl">
                <summary
                  className={clsx(
                    "flex cursor-pointer list-none items-center justify-center gap-2 rounded-full px-3 py-1 text-center text-xs",
                    s.tone === "ok" && "bg-mint-wash text-mint",
                    s.tone === "error" && "bg-amber-wash text-amber",
                    s.tone === "neutral" && "bg-porcelain text-ink-soft ring-1 ring-line",
                  )}
                >
                  <span className="font-medium">{s.text}</span>
                  <span className="opacity-60 group-open:hidden">· detalji</span>
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-ink p-3 text-[0.6875rem] leading-relaxed text-porcelain/80">
                  {JSON.stringify({ argumenti: m.toolArgs, rezultat: m.toolResult }, null, 2)}
                </pre>
              </details>
            );
          }
          const fromClient = m.role === "user";
          return (
            <div key={m.id} className={clsx("flex flex-col", fromClient ? "items-start" : "items-end")}>
              <p
                className={clsx(
                  "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[0.9375rem] leading-snug whitespace-pre-line",
                  fromClient ? "rounded-bl-md bg-paper ring-1 ring-line" : "rounded-br-md bg-ink text-porcelain",
                )}
              >
                {m.content}
              </p>
              <span className="tabular mt-1 text-[0.6875rem] text-ink-faint">
                {fromClient ? "Klijent" : "Recepcioner"} · {m.time}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
