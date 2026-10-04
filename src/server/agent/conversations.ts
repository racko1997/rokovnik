// Spremanje razgovora i poruka. Isto za sve kanale (web chat, Instagram, WhatsApp, poziv).
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { clients, conversationMessages, conversations } from "../db/schema";
import type { Source } from "../services/booking";

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof conversationMessages.$inferSelect;
export type Channel = Exclude<Source, "dashboard" | "online">;

export async function getOrCreateConversation(salonId: string, channel: Channel, externalId: string): Promise<Conversation> {
  const [row] = await db
    .insert(conversations)
    .values({ salonId, channel, externalId })
    .onConflictDoUpdate({
      target: [conversations.salonId, conversations.channel, conversations.externalId],
      set: { lastMessageAt: sql`${conversations.lastMessageAt}` },
    })
    .returning();
  return row;
}

export async function findConversation(salonId: string, channel: Channel, externalId: string) {
  return db.query.conversations.findFirst({
    where: and(eq(conversations.salonId, salonId), eq(conversations.channel, channel), eq(conversations.externalId, externalId)),
  });
}

export async function appendMessages(
  conversationId: string,
  messages: Omit<typeof conversationMessages.$inferInsert, "conversationId">[],
) {
  if (!messages.length) return;
  // Svaka poruka dobija svoj milisekundni pomak da redoslijed ostane tačan
  const base = Date.now();
  await db
    .insert(conversationMessages)
    .values(messages.map((m, i) => ({ ...m, conversationId, createdAt: new Date(base + i) })));
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
}

export async function loadMessages(conversationId: string): Promise<Message[]> {
  return db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt));
}

export async function countUserMessages(conversationId: string): Promise<number> {
  return db.$count(conversationMessages, and(eq(conversationMessages.conversationId, conversationId), eq(conversationMessages.role, "user")));
}

export async function updateConversation(
  conversationId: string,
  patch: Partial<Pick<Conversation, "status" | "handoffReason" | "clientId">>,
) {
  await db.update(conversations).set(patch).where(eq(conversations.id, conversationId));
}

/** Za dashboard: razgovori salona, najnoviji prvi. */
export async function listConversations(salonId: string, limit = 50) {
  return db
    .select({
      conversation: conversations,
      clientName: clients.name,
      clientPhone: clients.phone,
      lastText: sql<string | null>`(
        select m.content from ${conversationMessages} m
        where m.conversation_id = ${conversations.id} and m.role <> 'tool'
        order by m.created_at desc limit 1
      )`,
      messageCount: sql<number>`(
        select count(*)::int from ${conversationMessages} m
        where m.conversation_id = ${conversations.id} and m.role = 'user'
      )`,
    })
    .from(conversations)
    .leftJoin(clients, eq(clients.id, conversations.clientId))
    .where(
      and(
        eq(conversations.salonId, salonId),
        // Razgovori u kojima nijedna poruka nije sačuvana (npr. pao poziv prema OpenAI-ju) se ne prikazuju
        sql`exists (select 1 from ${conversationMessages} m where m.conversation_id = ${conversations.id})`,
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit);
}

export async function getConversationForSalon(salonId: string, id: string) {
  return db.query.conversations.findFirst({ where: and(eq(conversations.id, id), eq(conversations.salonId, salonId)) });
}
