import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Fontovi za kartice pri dijeljenju linka (assets/og, OFL). Dinamičke rute ih
// dobijaju preko outputFileTracingIncludes u next.config.ts.
const file = (name: string) => readFile(join(process.cwd(), "assets/og", name));

export async function ogFonts() {
  const [serif, serifExt, sans, sansExt] = await Promise.all([
    file("young-serif-latin-400-normal.woff"),
    file("young-serif-latin-ext-400-normal.woff"),
    file("hanken-grotesk-latin-500-normal.woff"),
    file("hanken-grotesk-latin-ext-500-normal.woff"),
  ]);
  return [
    { name: "Young Serif", data: serif, weight: 400 as const },
    { name: "Young Serif", data: serifExt, weight: 400 as const },
    { name: "Hanken", data: sans, weight: 500 as const },
    { name: "Hanken", data: sansExt, weight: 500 as const },
  ];
}
