import { and, asc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { db, type Tx } from "../db/client";
import { clients } from "../db/schema";
import { DomainError } from "../errors";

export type Client = typeof clients.$inferSelect;

export const clientInput = z.object({
  name: z.string().trim().min(2, "Unesite ime klijenta.").max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .nullish()
    .transform((v) => v || null),
  email: z
    .union([z.email("Neispravan email."), z.literal("")])
    .nullish()
    .transform((v) => v || null),
});

/**
 * Pronalazi klijenta po broju telefona ili ga kreira.
 * Telefon je zajednički ključ za sve kanale (web, Instagram, WhatsApp, poziv).
 */
export async function findOrCreateClient(tx: Tx, salonId: string, raw: z.input<typeof clientInput>): Promise<Client> {
  const input = clientInput.parse(raw);
  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(input.phone);
    if (!phone) throw new DomainError("INVALID_INPUT", "Broj telefona nije ispravan.");
  }

  if (phone) {
    const [upserted] = await tx
      .insert(clients)
      .values({ salonId, name: input.name, phone, email: input.email })
      .onConflictDoUpdate({
        target: [clients.salonId, clients.phone],
        // Zadržavamo ime koje salon već ima; dopunjavamo email ako ga nije bilo
        set: { updatedAt: new Date() },
      })
      .returning();
    if (!upserted.email && input.email) {
      await tx.update(clients).set({ email: input.email }).where(eq(clients.id, upserted.id));
    }
    return upserted;
  }

  const [created] = await tx.insert(clients).values({ salonId, name: input.name, email: input.email }).returning();
  return created;
}

export async function searchClients(salonId: string, query: string, limit = 8): Promise<Client[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, "").replace(/^0/, "");
  const conds = [ilike(clients.name, `%${q}%`)];
  if (digits.length >= 3) conds.push(ilike(clients.phone, `%${digits}%`));
  return db
    .select()
    .from(clients)
    .where(and(eq(clients.salonId, salonId), or(...conds)))
    .orderBy(asc(clients.name))
    .limit(limit);
}
