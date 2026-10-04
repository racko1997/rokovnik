/**
 * Javna adresa aplikacije. Redom: BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL iz okruženja,
 * pa produkcijska adresa koju Vercel sam postavlja.
 */
export function appUrl(): string {
  const explicit = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : "";
}

/** Sve adrese pod kojima Vercel služi ovu verziju (produkcija, grana, konkretan deploy). */
export function vercelUrls(): string[] {
  return [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((v): v is string => Boolean(v))
    .map((v) => `https://${v}`);
}
