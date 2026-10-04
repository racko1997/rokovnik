/**
 * Lokalna PostgreSQL baza za razvoj (bez Dockera).
 * Pokreće pravi Postgres server iz npm paketa `embedded-postgres`,
 * tako da je razvojno okruženje identično produkciji.
 *
 *   npm run db:start   → pokreće bazu i drži je upaljenu (Ctrl+C gasi)
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(".data/postgres");
const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const DB_NAME = "rokovnik";

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: true,
    // UTF-8 je obavezan za č, ć, š, đ, ž (Windows inače bira WIN1252)
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });

  const firstRun = !existsSync(path.join(DATA_DIR, "PG_VERSION"));
  if (firstRun) {
    console.log("Inicijalizujem lokalnu bazu…");
    await pg.initialise();
  }
  await pg.start();
  if (firstRun) await pg.createDatabase(DB_NAME);

  console.log(`Postgres radi: postgres://postgres:postgres@localhost:${PORT}/${DB_NAME}`);
  console.log("Ctrl+C za gašenje.");

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error("Baza se nije pokrenula:", err instanceof Error ? err.message : err);
  if (existsSync(path.join(DATA_DIR, "postmaster.pid"))) {
    console.error(`Vjerovatno je ostao upaljen stari Postgres proces (port ${PORT}).`);
    console.error("Zatvorite ga u Task Manageru (postgres.exe) ili restartujte računar, pa pokušajte ponovo.");
  }
  process.exit(1);
});
