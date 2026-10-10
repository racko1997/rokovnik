import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

// Pretraživači vide naslovnu, stranice salona i pravne stranice; dashboard i privatni linkovi ne.
export default function robots(): MetadataRoute.Robots {
  const base = appUrl() || "http://localhost:3100";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/api", "/termin", "/nova-lozinka", "/pozivnica", "/novi-salon"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
