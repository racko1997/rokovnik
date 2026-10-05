import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./context";
import { adminEmails } from "./notify";

/** Vlasnici platforme (ne salona): emailovi iz ADMIN_EMAILS, odvojeni zarezom. */
export async function requirePlatformAdmin() {
  const user = await requireUser();
  const admins = adminEmails().map((e) => e.toLowerCase());
  // Za sve ostale stranica "ne postoji"
  if (!admins.includes(user.email.toLowerCase())) notFound();
  return user;
}
