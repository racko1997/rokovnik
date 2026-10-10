import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Slanje emaila preko Resend API-ja (resend.com). Bez RESEND_API_KEY ne radi ništa
 * i vraća false — aplikacija radi normalno, samo bez obavijesti.
 */
export async function sendEmail(msg: { to: string[]; subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  // .test adrese (demo i probni nalozi) ne postoje — slanje bi samo kvarilo ugled domene
  const to = msg.to.filter((e) => !e.toLowerCase().endsWith(".test"));
  if (!key || !to.length) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Bez vlastitog domena Resend dozvoljava slanje samo na email vlasnika naloga
        from: process.env.EMAIL_FROM || "Rokovnik <onboarding@resend.dev>",
        to,
        subject: msg.subject,
        text: msg.text,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return true;
  } catch (err) {
    console.error("[email]", err);
    Sentry.captureException(err, { tags: { area: "email" } });
    return false;
  }
}

/** Emailovi vlasnika platforme (isti kao za /admin). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    // Vercel polje ponekad dobije navodnike ili razmake — sve to ignorišemo
    .map((e) => e.trim().replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
}

/**
 * Mailovi salonima i klijentima (reset lozinke, potvrda emaila…) idu tek s vlastitim domenom.
 * Testni Resend pošiljalac smije slati samo vlasniku Resend naloga, pa bez EMAIL_FROM ne pokušavamo.
 */
export function canEmailAnyone(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendUserEmail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  if (canEmailAnyone()) return sendEmail({ ...msg, to: [msg.to] });
  // Lokalno ispišemo cijeli mail (i link) da se tok može isprobati; u produkciji linkovi ne idu u logove
  if (process.env.NODE_ENV !== "production") console.info(`[email nije uključen] ${msg.to} · ${msg.subject}\n${msg.text}`);
  else console.info(`[email nije uključen] preskočeno: ${msg.subject}`);
  return false;
}
