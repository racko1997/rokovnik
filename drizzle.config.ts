import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  // Migracije idu preko direktne konekcije (Supabase: "Session pooler" ili "Direct"),
  // aplikacija može koristiti pooler (DATABASE_URL).
  dbCredentials: { url: process.env.DIRECT_URL || process.env.DATABASE_URL! },
});
