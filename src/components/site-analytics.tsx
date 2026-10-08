"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Anonimna statistika posjeta (Vercel Web Analytics, bez kolačića).
 * Mjerimo samo javne stranice: dashboard salona nije marketing, a link termina
 * sadrži token koji ne smije završiti u statistici.
 */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const path = new URL(event.url).pathname;
        if (path.startsWith("/app") || path.startsWith("/admin") || path.startsWith("/termin") || path.startsWith("/nova-lozinka")) {
          return null;
        }
        return event;
      }}
    />
  );
}
