import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fontovi za kartice pri dijeljenju linka čitaju se s diska (src/server/og-fonts.ts)
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/og/**"],
    "/s/[slug]/opengraph-image": ["./assets/og/**"],
  },
  async redirects() {
    return [
      // Česte varijante adrese admin stranice
      { source: "/admin", destination: "/admin/prijave", permanent: false },
      { source: "/admin/prijava", destination: "/admin/prijave", permanent: false },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Čitljivi tragovi grešaka se šalju samo kad je podešen token (npr. na Vercelu)
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: !process.env.CI,
  telemetry: false,
});
