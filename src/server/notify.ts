import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Slanje emaila preko Resend API-ja (resend.com). Bez RESEND_API_KEY ne radi ništa
 * i vraća false — aplikacija radi normalno, samo bez obavijesti.
 */
export async function sendEmail(msg: { to: string[]; subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !msg.to.length) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Bez vlastitog domena Resend dozvoljava slanje samo na email vlasnika naloga
        from: process.env.EMAIL_FROM || "Rokovnik <onboarding@resend.dev>",
        to: msg.to,
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
    .map((e) => e.trim())
    .filter(Boolean);
}
