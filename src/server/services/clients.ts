import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { db, type Tx } from "../db/client";
import { appointmentItems, appointments, appointmentSource, appointmentStatus, clients, staff } from "../db/schema";
import { DomainError, isUniqueViolation } from "../errors";

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

// ─── Lista klijenata i detalji (stranica Klijenti) ──────────────────────────

export interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  visits: number;
  noShows: number;
  lastVisit: Date | null;
  nextVisit: Date | null;
  spentCents: number;
}

export type ClientSort = "recent" | "name" | "visits";

/** Klijenti salona sa statistikom posjeta. Pretraga po imenu ili broju telefona. */
export async function listClientsWithStats(
  salonId: string,
  opts: { q?: string; sort?: ClientSort; limit?: number; offset?: number } = {},
): Promise<{ rows: ClientRow[]; total: number }> {
  const conds = [eq(clients.salonId, salonId)];
  const q = opts.q?.trim();
  if (q && q.length >= 2) {
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    conds.push(or(ilike(clients.name, `%${q}%`), ...(digits.length >= 3 ? [ilike(clients.phone, `%${digits}%`)] : []))!);
  }
  const where = and(...conds);

  // Puno ime kolone — u podupitima i termini imaju "id"
  const cid = sql.raw(`"clients"."id"`);
  // Statistika iz termina: prošli (ne otkazani) = posjete, nedolasci, sljedeći termin, potrošeno
  const visits = sql<number>`(select count(*)::int from ${appointments} a where a.client_id = ${cid}
    and a.starts_at < now() and a.status in ('booked','confirmed','completed'))`;
  const noShows = sql<number>`(select count(*)::int from ${appointments} a where a.client_id = ${cid} and a.status = 'no_show')`;
  const lastVisit = sql<Date | null>`(select max(a.starts_at) from ${appointments} a where a.client_id = ${cid}
    and a.starts_at < now() and a.status in ('booked','confirmed','completed'))`;
  const nextVisit = sql<Date | null>`(select min(a.starts_at) from ${appointments} a where a.client_id = ${cid}
    and a.starts_at >= now() and a.status in ('booked','confirmed'))`;
  const spent = sql<number>`(select coalesce(sum(i.price_cents), 0)::int from ${appointmentItems} i
    join ${appointments} a on a.id = i.appointment_id where a.client_id = ${cid} and a.status = 'completed')`;

  const order =
    opts.sort === "name" ? [asc(clients.name)] : opts.sort === "visits" ? [desc(visits), asc(clients.name)] : [desc(sql`coalesce(${lastVisit}, "clients"."created_at")`)];

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        email: clients.email,
        notes: clients.notes,
        createdAt: clients.createdAt,
        visits,
        noShows,
        lastVisit,
        nextVisit,
        spentCents: spent,
      })
      .from(clients)
      .where(where)
      .orderBy(...order)
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0),
    db.select({ total: sql<number>`count(*)::int` }).from(clients).where(where),
  ]);
  // Raw podupiti vraćaju datume kao tekst
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      lastVisit: r.lastVisit ? new Date(r.lastVisit) : null,
      nextVisit: r.nextVisit ? new Date(r.nextVisit) : null,
    })),
  };
}

export interface ClientVisit {
  appointmentId: string;
  startsAt: Date;
  status: (typeof appointmentStatus.enumValues)[number];
  source: (typeof appointmentSource.enumValues)[number];
  services: string[];
  staff: string[];
  priceCents: number;
  notes: string | null;
}

/** Historija termina jednog klijenta, najnoviji prvi. */
export async function getClientHistory(salonId: string, clientId: string, limit = 100): Promise<ClientVisit[]> {
  const rows = await db
    .select({
      appointmentId: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      source: appointments.source,
      notes: appointments.notes,
      serviceName: appointmentItems.serviceName,
      part: appointmentItems.part,
      priceCents: appointmentItems.priceCents,
      staffName: staff.name,
    })
    .from(appointments)
    .innerJoin(appointmentItems, eq(appointmentItems.appointmentId, appointments.id))
    .innerJoin(staff, eq(staff.id, appointmentItems.staffId))
    .where(and(eq(appointments.salonId, salonId), eq(appointments.clientId, clientId)))
    .orderBy(desc(appointments.startsAt), asc(appointmentItems.startsAt))
    .limit(limit * 4);

  const byId = new Map<string, ClientVisit>();
  for (const r of rows) {
    const v = byId.get(r.appointmentId) ?? {
      appointmentId: r.appointmentId,
      startsAt: r.startsAt,
      status: r.status,
      source: r.source,
      services: [],
      staff: [],
      priceCents: 0,
      notes: r.notes,
    };
    if (r.part === 0) v.services.push(r.serviceName);
    if (!v.staff.includes(r.staffName)) v.staff.push(r.staffName);
    v.priceCents += r.priceCents;
    byId.set(r.appointmentId, v);
  }
  return [...byId.values()].slice(0, limit);
}

export const updateClientInput = z.object({
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
  notes: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => v || null),
});

/** Novi klijent (bez termina) ili izmjena postojećeg. */
export async function saveClient(salonId: string, id: string | null, raw: z.input<typeof updateClientInput>): Promise<string> {
  const input = updateClientInput.parse(raw);
  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(input.phone);
    if (!phone) throw new DomainError("INVALID_INPUT", "Broj telefona nije ispravan.");
  }
  const values = { name: input.name, phone, email: input.email, notes: input.notes };
  try {
    if (id) {
      const updated = await db
        .update(clients)
        .set(values)
        .where(and(eq(clients.id, id), eq(clients.salonId, salonId)))
        .returning({ id: clients.id });
      if (!updated.length) throw new DomainError("NOT_FOUND", "Klijent ne postoji.");
      return id;
    }
    const [created] = await db.insert(clients).values({ ...values, salonId }).returning({ id: clients.id });
    return created.id;
  } catch (err) {
    if (isUniqueViolation(err, "clients_salon_phone_uq")) {
      throw new DomainError("INVALID_INPUT", "Klijent s tim brojem telefona već postoji.");
    }
    throw err;
  }
}
