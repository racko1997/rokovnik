import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSession } from "./context";
import { adminEmails } from "./notify";

/**
 * Pristup administraciji platforme (vlasnici platforme, ne salona): emailovi iz ADMIN_EMAILS.
 * Stranica prijavljenom korisniku bez pristupa kaže kojim je nalogom ušao, umjesto tihog 404.
 */
export async function platformAdminAccess() {
  const session = await getSession();
  if (!session) redirect("/prijava?next=/admin/prijave");
  const user = session.user;
  const admins = adminEmails().map((e) => e.toLowerCase());
  return { user, ok: admins.includes(user.email.toLowerCase()), configured: admins.length > 0 };
}

/** Za akcije: bez pristupa akcija "ne postoji". */
export async function requirePlatformAdmin() {
  const access = await platformAdminAccess();
  if (!access.ok) notFound();
  return access.user;
}
