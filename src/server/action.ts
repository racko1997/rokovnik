import "server-only";
import { z } from "zod";
import { DomainError } from "./errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Omotač za server akcije: poslovne i validacione greške vraća kao poruku
 * za korisnika, a neočekivane loguje i prikazuje generičku poruku.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { ok: false, error: err.issues[0]?.message ?? "Provjerite unesene podatke.", fieldErrors };
    }
    // redirect() i notFound() iz Next-a moraju proći dalje
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error(err);
    return { ok: false, error: "Nešto nije u redu na serveru. Pokušajte ponovo." };
  }
}
