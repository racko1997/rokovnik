// Domenski model. Svaka tabela nosi `salon_id` — to je granica između salona
// (multi-tenant). Svaki upit u servisnom sloju MORA filtrirati po salon_id.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const tz = { withTimezone: true } as const;
const createdAt = () => timestamp(tz).defaultNow().notNull();
const updatedAt = () =>
  timestamp(tz)
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const memberRole = pgEnum("member_role", ["owner", "manager", "staff"]);

export const appointmentStatus = pgEnum("appointment_status", [
  "booked",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

/** Kanal preko kojeg je termin nastao — bitno za statistiku AI recepcionera. */
export const appointmentSource = pgEnum("appointment_source", [
  "dashboard",
  "online",
  "chat",
  "instagram",
  "messenger",
  "whatsapp",
  "viber",
  "voice",
]);

export const salons = pgTable("salons", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  timezone: text().notNull().default("Europe/Sarajevo"),
  currency: text().notNull().default("BAM"),
  phone: text(),
  email: text(),
  address: text(),
  city: text(),
  about: text(),
  // Pravila online zakazivanja
  slotIntervalMin: integer().notNull().default(15),
  minLeadMin: integer().notNull().default(60),
  maxAdvanceDays: integer().notNull().default(60),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const salonMembers = pgTable(
  "salon_members",
  {
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole().notNull().default("owner"),
    // Ako je član ujedno i radnik u kalendaru
    staffId: uuid().references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.salonId, t.userId] }), index().on(t.userId)],
);

export const staff = pgTable(
  "staff",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text().notNull(),
    title: text(),
    /** Ključ nijanse iz palete (vidi `src/lib/swatches.ts`). */
    color: text().notNull().default("rubin"),
    phone: text(),
    email: text(),
    bookableOnline: boolean().notNull().default(true),
    active: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    /** 1 = isti raspored svake sedmice, 2 = smjene se izmjenjuju (sedmica A / B) */
    rotationWeeks: smallint().notNull().default(1),
    /** Ponedjeljak sedmice koja je "sedmica A" (samo kad je rotationWeeks = 2) */
    rotationAnchor: date({ mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.salonId), check("staff_rotation", sql`${t.rotationWeeks} in (1, 2)`)],
);

/**
 * Radno vrijeme po danu u sedmici, u lokalnim minutama od ponoći.
 * Više redova za isti dan = podijeljena smjena (razmak je pauza).
 * weekday: 1 = ponedjeljak … 7 = nedjelja (ISO).
 */
export const workingHours = pgTable(
  "working_hours",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    weekday: smallint().notNull(),
    /** Za smjene koje se izmjenjuju: 0 = sedmica A, 1 = sedmica B */
    week: smallint().notNull().default(0),
    startMin: integer().notNull(),
    endMin: integer().notNull(),
  },
  (t) => [
    index().on(t.staffId, t.weekday),
    check("working_hours_week", sql`${t.week} in (0, 1)`),
    check("working_hours_range", sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.startMin} < ${t.endMin}`),
    check("working_hours_weekday", sql`${t.weekday} between 1 and 7`),
  ],
);

/**
 * Izmjena radnog vremena za jedan konkretan datum (mijenja redovni raspored samo taj dan).
 * `shifts` = [] znači slobodan dan. Datum je lokalni kalendarski datum salona.
 */
export const staffDayOverrides = pgTable(
  "staff_day_overrides",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    shifts: jsonb().$type<{ startMin: number; endMin: number }[]>().notNull(),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("staff_day_overrides_staff_date_uq").on(t.staffId, t.date), index().on(t.salonId, t.date)],
);

/** Neradni dani cijelog salona (praznici, kolektivni odmor). Uključivo od–do. */
export const salonClosures = pgTable(
  "salon_closures",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }).notNull(),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.salonId, t.startDate), check("salon_closures_range", sql`${t.startDate} <= ${t.endDate}`)],
);

/** Odsustva: godišnji, bolovanje, slobodan dan, blokirano vrijeme. */
export const timeOff = pgTable(
  "time_off",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    startsAt: timestamp(tz).notNull(),
    endsAt: timestamp(tz).notNull(),
    reason: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.staffId, t.startsAt),
    check("time_off_range", sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text().notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index().on(t.salonId)],
);

export const services = pgTable(
  "services",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    categoryId: uuid().references(() => serviceCategories.id, { onDelete: "set null" }),
    name: text().notNull(),
    description: text(),
    durationMin: integer().notNull(),
    /** Vrijeme nakon usluge (čišćenje, priprema) — radnik je zauzet, klijent ne vidi. */
    bufferMin: integer().notNull().default(0),
    /** Cijena u feninzima/centima, da izbjegnemo greške zaokruživanja. */
    priceCents: integer().notNull(),
    /** "od 30 KM" — konačna cijena zavisi od dužine kose i sl. */
    priceFrom: boolean().notNull().default(false),
    bookableOnline: boolean().notNull().default(true),
    active: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.salonId),
    check("services_duration", sql`${t.durationMin} > 0 and ${t.bufferMin} >= 0`),
    check("services_price", sql`${t.priceCents} >= 0`),
  ],
);

/** Koji radnik radi koju uslugu. */
export const staffServices = pgTable(
  "staff_services",
  {
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.serviceId] }), index().on(t.serviceId)],
);

export const clients = pgTable(
  "clients",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** E.164 format (+387…), normalizovan — ključ za prepoznavanje klijenta na svim kanalima. */
    phone: text(),
    email: text(),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("clients_salon_phone_uq").on(t.salonId, t.phone),
    index().on(t.salonId, t.name),
  ],
);

/** Posjeta klijenta. Može sadržavati više usluga (stavki). */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    clientId: uuid().references(() => clients.id, { onDelete: "set null" }),
    status: appointmentStatus().notNull().default("booked"),
    source: appointmentSource().notNull().default("dashboard"),
    startsAt: timestamp(tz).notNull(),
    endsAt: timestamp(tz).notNull(),
    notes: text(),
    createdByUserId: text().references(() => user.id, { onDelete: "set null" }),
    /** Razgovor iz kojeg je termin nastao (AI recepcioner). */
    conversationId: uuid().references((): AnyPgColumn => conversations.id, { onDelete: "set null" }),
    cancelledAt: timestamp(tz),
    cancelReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.salonId, t.startsAt), index().on(t.clientId)],
);

/**
 * Jedna usluga unutar posjete, kod jednog radnika.
 * Preklapanje termina istog radnika sprječava sama baza (exclusion constraint
 * u migraciji 0001) — to je posljednja linija odbrane od duplih rezervacija,
 * čak i kad AI i čovjek zakazuju u istoj sekundi.
 */
export const appointmentItems = pgTable(
  "appointment_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    appointmentId: uuid()
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    staffId: uuid()
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    serviceId: uuid()
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    // Snimak u trenutku rezervacije — promjena cjenovnika ne mijenja stare termine
    serviceName: text().notNull(),
    priceCents: integer().notNull(),
    startsAt: timestamp(tz).notNull(),
    endsAt: timestamp(tz).notNull(),
    /** endsAt + buffer usluge. Radnik je zauzet do ovog trenutka. */
    blockedUntil: timestamp(tz).notNull(),
    /** false kad je posjeta otkazana — oslobađa termin. */
    active: boolean().notNull().default(true),
  },
  (t) => [
    index().on(t.salonId, t.startsAt),
    index().on(t.staffId, t.startsAt),
    index().on(t.appointmentId),
    check("appointment_items_range", sql`${t.startsAt} < ${t.endsAt} and ${t.endsAt} <= ${t.blockedUntil}`),
  ],
);

// ─── Razgovori (AI recepcioner) ──────────────────────────────────────────────

export const conversationStatus = pgEnum("conversation_status", ["open", "handoff", "closed"]);
export const messageRole = pgEnum("message_role", ["user", "assistant", "tool"]);

/**
 * Jedna nit razgovora na jednom kanalu (web chat, Instagram, WhatsApp, poziv…).
 * `externalId` je ID niti na tom kanalu — za web chat nasumičan token.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    salonId: uuid()
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    channel: appointmentSource().notNull(),
    externalId: text().notNull(),
    clientId: uuid().references(() => clients.id, { onDelete: "set null" }),
    status: conversationStatus().notNull().default("open"),
    /** Razlog zašto je AI prebacio razgovor na osoblje. */
    handoffReason: text(),
    lastMessageAt: timestamp(tz).defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("conversations_channel_external_uq").on(t.salonId, t.channel, t.externalId),
    index().on(t.salonId, t.lastMessageAt),
  ],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole().notNull(),
    content: text().notNull().default(""),
    /** Za role = tool: koji alat je AI pozvao, s kojim argumentima i šta je dobio. */
    toolName: text(),
    toolArgs: jsonb(),
    toolResult: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.conversationId, t.createdAt)],
);
