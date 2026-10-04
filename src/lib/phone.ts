import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalizuje broj telefona u E.164 (+38761…). Domaći brojevi bez pozivnog
 * broja tretiraju se kao BiH. Vraća null za neispravan broj.
 */
export function normalizePhone(input: string, defaultCountry: "BA" | "RS" | "HR" | "ME" = "BA"): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** +38761234567 → "061 234 567" za domaće, međunarodni format za ostale. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "BA" ? parsed.formatNational() : parsed.formatInternational();
}
