import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";
import { listPublicSalons } from "@/server/services/salons";

// Mapa javnih stranica za Google: naslovna, registracija, pravne stranice i stranica svakog salona.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl() || "http://localhost:3100";
  const salons = await listPublicSalons();
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/registracija`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privatnost`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/uslovi`, changeFrequency: "yearly", priority: 0.2 },
    ...salons.map((s) => ({ url: `${base}/s/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
