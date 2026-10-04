import path from "node:path";
import { defineConfig } from "vitest/config";

// `npm test` — brzi testovi bez baze; `npm run test:db` — integracioni (*.db.test.ts)
const dbTests = process.env.DB_TESTS === "1";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: [dbTests ? "src/**/*.db.test.ts" : "src/**/*.test.ts"],
    exclude: dbTests ? [] : ["src/**/*.db.test.ts", "node_modules/**"],
    fileParallelism: !dbTests,
    // Udaljena baza (Supabase) zna biti spora — testovi nad bazom dobijaju više vremena
    testTimeout: dbTests ? 30_000 : 5_000,
    hookTimeout: dbTests ? 30_000 : 10_000,
  },
});
