import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appUrl } from "@/lib/app-url";

/**
 * Link kojim klijent sam otkazuje ili pomjera svoj termin, bez naloga i lozinke.
 * Token je ID termina + potpis (HMAC), pa ništa ne čuvamo u bazi i isti link se
 * može ponovo napraviti (potvrda, podsjetnik…). Ko nema link, ne može pogoditi tuđi.
 */
function sign(appointmentId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET nije postavljen");
  return createHmac("sha256", secret).update(`manage:${appointmentId}`).digest("base64url").slice(0, 24);
}

export function manageToken(appointmentId: string): string {
  return `${appointmentId}.${sign(appointmentId)}`;
}

/** ID termina ako je potpis ispravan, inače null. */
export function verifyManageToken(token: string): string | null {
  const [id, sig] = token.split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? id : null;
}

export function managePath(appointmentId: string): string {
  return `/termin/${manageToken(appointmentId)}`;
}

export function manageUrl(appointmentId: string): string {
  return `${appUrl() || "http://localhost:3100"}${managePath(appointmentId)}`;
}
