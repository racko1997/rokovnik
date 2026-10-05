import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./context";

/** Vlasnici platforme (ne salona): emailovi iz ADMIN_EMAILS, odvojeni zarezom. */
export async function requirePlatformAdmin() {
  const user = await requireUser();
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Za sve ostale stranica "ne postoji"
  if (!admins.includes(user.email.toLowerCase())) notFound();
  return user;
}
