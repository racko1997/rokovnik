// Tabele koje koristi Better Auth (korisnici, sesije, nalozi, verifikacija).
// Struktura prati zvaničnu Better Auth shemu — ne mijenjati nazive polja.
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const tz = { withTimezone: true } as const;

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().default(false).notNull(),
  image: text(),
  createdAt: timestamp(tz).defaultNow().notNull(),
  updatedAt: timestamp(tz)
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp(tz).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp(tz).defaultNow().notNull(),
    updatedAt: timestamp(tz)
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(tz),
    refreshTokenExpiresAt: timestamp(tz),
    scope: text(),
    password: text(),
    createdAt: timestamp(tz).defaultNow().notNull(),
    updatedAt: timestamp(tz)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp(tz).notNull(),
    createdAt: timestamp(tz).defaultNow().notNull(),
    updatedAt: timestamp(tz)
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
