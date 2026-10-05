// Praćenje grešaka na serveru. Bez SENTRY_DSN je isključeno (ništa se ne šalje).
// Lični podaci (kolačići, zaglavlja, korisnik) se po defaultu ne šalju.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
