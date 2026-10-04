import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL nije postavljen (pogledaj .env.example)");

  // Supabase "Transaction pooler" (port 6543) dijeli jednu transakciju na više konekcija
  // prema bazi — dio upisa se tiho izgubi (provjereno). Za rezervacije to nije prihvatljivo.
  if (/:6543\b/.test(url) || url.includes("pgbouncer=true")) {
    throw new Error("DATABASE_URL koristi Supabase Transaction pooler (port 6543). Koristite Session pooler (port 5432).");
  }

  // Supabase Session pooler ima ograničen broj konekcija koje dijele svi (lokalni
  // server, Vercel, testovi) — zato mali pool. Može se promijeniti s DB_POOL_MAX.
  const max = Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 2 : 5);
  const client = postgres(url, { max, idle_timeout: 20 });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
/** Transakcija ili glavna konekcija — servisi rade s oba. */
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Tx = Db | Transaction;

// Konekcija se otvara tek pri prvom upitu (ne pri učitavanju modula), tako da
// build radi i bez baze. Čuvamo je kroz ponovna učitavanja modula u razvoju.
const globalForDb = globalThis as unknown as { db?: Db };

function getDb(): Db {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}

export const db = new Proxy({} as Db, {
  get(_, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
