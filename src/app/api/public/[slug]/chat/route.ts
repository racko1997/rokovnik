import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { findConversation, loadMessages } from "@/server/agent/conversations";
import { AgentUnavailableError, respond } from "@/server/agent/receptionist";
import { rateLimit } from "@/server/rate-limit";
import { getSalonBySlug } from "@/server/services/salons";

const body = z.object({
  /** Nasumičan token koji preglednik čuva za ovaj razgovor. */
  sessionId: z.string().min(16).max(64),
  message: z.string().trim().min(1).max(1000),
});

type Ctx = { params: Promise<{ slug: string }> };

/** Poruka klijenta u web chatu → odgovor AI recepcionera. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const salon = await getSalonBySlug(slug);
  if (!salon) return NextResponse.json({ error: "Salon ne postoji." }, { status: 404 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Poruka nije ispravna." }, { status: 400 });
  const { sessionId, message } = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`chat:ip:${ip}`, 30, 60_000) || !rateLimit(`chat:s:${sessionId}`, 12, 60_000)) {
    return NextResponse.json({ error: "Previše poruka zaredom. Sačekajte malo." }, { status: 429 });
  }

  try {
    const res = await respond({ salon, channel: "chat", externalId: sessionId, text: message });
    if (res.booked) revalidatePath("/app/kalendar");
    return NextResponse.json({ reply: res.reply, status: res.status, booked: res.booked });
  } catch (err) {
    if (err instanceof AgentUnavailableError) {
      return NextResponse.json(
        { error: `Chat trenutno nije dostupan.${salon.phone ? ` Pozovite salon na ${salon.phone}.` : ""}` },
        { status: 503 },
      );
    }
    console.error("[chat]", err);
    return NextResponse.json({ error: "Odgovor nije stigao. Pokušajte ponovo." }, { status: 502 });
  }
}

/** Historija razgovora (kad klijent ponovo otvori stranicu). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const sessionId = req.nextUrl.searchParams.get("sessionId") ?? "";
  const salon = await getSalonBySlug(slug);
  if (!salon || sessionId.length < 16) return NextResponse.json({ messages: [], enabled: Boolean(process.env.OPENAI_API_KEY) });
  const conv = await findConversation(salon.id, "chat", sessionId);
  if (!conv) return NextResponse.json({ messages: [], enabled: Boolean(process.env.OPENAI_API_KEY) });
  const messages = (await loadMessages(conv.id))
    .filter((m) => m.role !== "tool" && m.content)
    .map((m) => ({ role: m.role, content: m.content }));
  return NextResponse.json({ messages, enabled: Boolean(process.env.OPENAI_API_KEY) });
}
