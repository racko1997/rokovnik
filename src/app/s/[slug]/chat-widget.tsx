"use client";

import { clsx } from "clsx";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
  booked?: boolean;
}

const STARTERS = ["Ima li slobodno sutra?", "Koliko košta šišanje?", "Želim otkazati termin"];

function sessionKey(slug: string) {
  return `rokovnik:chat:${slug}`;
}

/** Čuva ID razgovora u pregledniku, da se razgovor nastavi i nakon osvježavanja. */
function loadSessionId(slug: string): string {
  try {
    const existing = localStorage.getItem(sessionKey(slug));
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(sessionKey(slug), id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function ChatWidget({ slug, salonName }: { slug: string; salonName: string }) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Učitaj prethodni razgovor kad se chat prvi put otvori
  useEffect(() => {
    if (!open || sessionId) return;
    const id = loadSessionId(slug);
    fetch(`/api/public/${slug}/chat?sessionId=${id}`)
      .then((r) => r.json())
      .then((d: { messages: Msg[] }) => {
        setSessionId(id);
        setMessages(d.messages ?? []);
      })
      .catch(() => setSessionId(id));
  }, [open, sessionId, slug]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(content: string) {
    const message = content.trim();
    if (!message || sending || !sessionId) return;
    setText("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: message }]);
    setSending(true);
    try {
      const res = await fetch(`/api/public/${slug}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Odgovor nije stigao.");
      setMessages((m) => [...m, { role: "assistant", content: data.reply, booked: data.booked }]);
    } catch (e) {
      setError((e as Error).message);
      setMessages((m) => m.slice(0, -1));
      setText(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Otvori chat sa salonom"
        className={clsx(
          "fixed right-4 bottom-4 z-40 flex items-center gap-2.5 rounded-full bg-ink py-3 pr-5 pl-4 text-porcelain shadow-[var(--shadow-pop)] transition-[transform,opacity] hover:-translate-y-0.5 sm:right-6 sm:bottom-6",
          open && "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <span className="relative">
          <MessageCircle size={20} />
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-mint ring-2 ring-ink" />
        </span>
        <span className="text-[0.9375rem] font-medium">Pišite nam</span>
      </button>

      {open && (
        <section
          aria-label={`Chat sa salonom ${salonName}`}
          className="fixed inset-0 z-50 flex animate-[rise_200ms_ease-out] flex-col bg-paper sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[38rem] sm:max-h-[calc(100dvh-3rem)] sm:w-[24rem] sm:rounded-[1.25rem] sm:shadow-[var(--shadow-pop)] sm:ring-1 sm:ring-line"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-porcelain">
              {salonName[0]}
              <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-mint ring-2 ring-paper" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg leading-tight">{salonName}</span>
              <span className="block text-xs text-ink-soft">Recepcija · odgovara odmah</span>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Zatvori chat" className="rounded-full p-2 text-ink-soft hover:bg-ink/5 hover:text-ink">
              <X size={18} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="pt-2">
                <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-porcelain px-3.5 py-2.5 text-[0.9375rem]">
                  Zdravo! Ovdje možete pitati za cijene, slobodne termine ili odmah zakazati.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={!sessionId}
                      className="rounded-full px-3 py-1.5 text-sm text-ink-soft ring-1 ring-line-strong hover:text-ink hover:ring-ink-faint"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={clsx("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                <p
                  className={clsx(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.9375rem] leading-snug whitespace-pre-line",
                    m.role === "user" ? "rounded-br-md bg-ink text-porcelain" : "rounded-bl-md bg-porcelain text-ink",
                  )}
                >
                  {m.content}
                </p>
                {m.booked && (
                  <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-mint-wash px-2.5 py-1 text-xs font-medium text-mint">
                    ✓ Termin je upisan u kalendar salona
                  </span>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex w-fit gap-1 rounded-2xl rounded-bl-md bg-porcelain px-4 py-3.5" aria-label="Recepcija piše">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            )}
          </div>

          {error && <p className="mx-4 mb-2 rounded-lg bg-lacquer-wash px-3 py-2 text-sm text-lacquer-deep">{error}</p>}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex items-end gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Napišite poruku…"
              aria-label="Poruka"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-[1.25rem] bg-porcelain px-4 py-2.5 text-[0.9375rem] ring-1 ring-line focus:ring-2 focus:ring-lacquer focus:outline-none"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending || !sessionId}
              aria-label="Pošalji"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lacquer text-white transition-opacity hover:bg-lacquer-deep disabled:opacity-40"
            >
              <ArrowUp size={20} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
