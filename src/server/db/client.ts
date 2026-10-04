import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL nije postavljen (pogledaj .env.example)");

// U razvoju Next ponovo učitava module — čuvamo jednu konekciju kroz reload.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
// Supabase "Transaction pooler" (port 6543) dijeli jednu transakciju na više konekcija
// prema bazi — dio upisa se tiho izgubi (provjereno). Za rezervacije to nije prihvatljivo.
if (/:6543/.test(url) || url.includes("pgbouncer=true")) {
  throw new Error(
    "DATABASE_URL koristi Supabase Transaction pooler (port 6543). Koristite Session pooler (port 5432).",
  );
}
const client = globalForDb.pg ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
/** Transakcija ili glavna konekcija — servisi rade s oba. */
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Tx = Db | Transaction;
