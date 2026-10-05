import { clsx } from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { formatPhone } from "@/lib/phone";
import { getConversationForSalon, listConversations, loadMessages } from "@/server/agent/conversations";
import { requireSalon } from "@/server/context";
import { toLocalDate, toLocalMinutes } from "@/server/domain/time";
import { ConversationThread } from "./thread";

export const metadata: Metadata = { title: "Razgovori" };

const CHANNEL: Record<string, string> = {
  chat: "Web chat",
  instagram: "Instagram",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  viber: "Viber",
  voice: "Poziv",
};

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { salon } = await requireSalon();
  const { c } = await searchParams;
  const tz = salon.timezone;
  const today = toLocalDate(new Date(), tz);

  const rows = await listConversations(salon.id);
  const selectedId = c ?? rows[0]?.conversation.id;
  const selected = selectedId ? await getConversationForSalon(salon.id, selectedId) : undefined;
  const messages = selected ? await loadMessages(selected.id) : [];

  const when = (d: Date) => {
    const date = toLocalDate(d, tz);
    const m = toLocalMinutes(d, tz);
    const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return date === today ? time : `${Number(date.slice(8))}.${Number(date.slice(5, 7))}. ${time}`;
  };

  return (
    <div className="flex h-[calc(100dvh-7.75rem)] flex-col lg:h-dvh">
      <PageHeader
        title="Razgovori"
        description="Šta je recepcioner odgovarao klijentima — svaka poruka i svaki korak koji je napravio."
      />

      {rows.length === 0 ? (
        <div className="px-4 sm:px-8">
          <div className="max-w-xl rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center">
            <p className="font-display text-2xl">Još nema razgovora</p>
            <p className="mx-auto mt-2 max-w-sm text-ink-soft">
              {process.env.OPENAI_API_KEY
                ? "Otvorite stranicu salona i napišite poruku u chatu kao klijent."
                : "Upišite OPENAI_API_KEY u .env i restartujte aplikaciju — chat će se pojaviti na stranici salona."}
            </p>
            <a href={`/s/${salon.slug}`} target="_blank" className="mt-4 inline-block text-sm font-medium text-lacquer hover:underline">
              Otvori stranicu salona ↗
            </a>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 border-t border-line md:grid-cols-[20rem_minmax(0,1fr)]">
          <ul className={clsx("overflow-y-auto border-r border-line bg-paper/50", selected && "hidden md:block")}>
            {rows.map(({ conversation: conv, clientName, clientPhone, lastText, messageCount }) => (
              <li key={conv.id}>
                <Link
                  href={`?c=${conv.id}`}
                  className={clsx(
                    "block border-b border-line px-4 py-3 transition-colors",
                    conv.id === selected?.id ? "bg-paper shadow-[inset_3px_0_0_var(--lacquer)]" : "hover:bg-paper",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{clientName ?? (clientPhone ? formatPhone(clientPhone) : "Nepoznat klijent")}</span>
                    <span className="tabular shrink-0 text-xs text-ink-faint">{when(conv.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-soft">{lastText ?? "…"}</span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs">
                    <span className="rounded-full bg-porcelain px-2 py-0.5 text-ink-soft ring-1 ring-line">{CHANNEL[conv.channel] ?? conv.channel}</span>
                    {conv.status === "handoff" && <span className="rounded-full bg-amber-wash px-2 py-0.5 font-medium text-amber">Treba odgovor</span>}
                    <span className="text-ink-faint">{messageCount} poruka</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {selected && (
            <ConversationThread
              channel={CHANNEL[selected.channel] ?? selected.channel}
              status={selected.status}
              handoffReason={selected.handoffReason}
              messages={messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                toolName: m.toolName,
                toolArgs: m.toolArgs,
                toolResult: m.toolResult,
                time: when(m.createdAt),
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
