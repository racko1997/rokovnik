// Obavijesti o terminima koje nije upisao sam salon: vlasniku/menadžeru mail za
// novi, otkazan ili pomjeren termin, a klijentu potvrda s linkom za promjene.
// Zove se iz `after()` — odgovor klijentu ne čeka slanje, a greška ne ruši rezervaciju.
import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { appUrl } from "@/lib/app-url";
import { db } from "../../db/client";
import { appointments, clients, salonMembers, user } from "../../db/schema";
import { clientConfirmationEmail, salonEventEmail, type SalonEvent } from "../../emails/booking";
import { manageUrl } from "../../manage-link";
import { sendUserEmail } from "../../notify";
import { getManagedAppointment } from "./manage";

export async function notifyBooking(
  appointmentId: string,
  event: SalonEvent,
  opts: { source?: string; previousStart?: Date; notifyClient?: boolean } = {},
) {
  try {
    const appt = await getManagedAppointment(appointmentId);
    if (!appt) return;
    const [c] = await db
      .select({ phone: clients.phone, email: clients.email, source: appointments.source })
      .from(appointments)
      .leftJoin(clients, eq(clients.id, appointments.clientId))
      .where(eq(appointments.id, appointmentId));

    const details = {
      salonName: appt.salon.name,
      timezone: appt.salon.timezone,
      startsAt: appt.startsAt,
      services: appt.services.map((s) => s.name),
      staff: appt.staff.map((s) => s.name),
      clientName: appt.clientName,
      clientPhone: c?.phone ?? null,
    };

    const recipients = await db
      .select({ email: user.email })
      .from(salonMembers)
      .innerJoin(user, eq(user.id, salonMembers.userId))
      .where(and(eq(salonMembers.salonId, appt.salon.id), inArray(salonMembers.role, ["owner", "manager"])));
    const salonMail = salonEventEmail(event, details, {
      source: opts.source ?? c?.source,
      previousStart: opts.previousStart,
      calendarUrl: `${appUrl() || "http://localhost:3100"}/app/kalendar`,
    });
    await Promise.all(recipients.map((r) => sendUserEmail({ to: r.email, ...salonMail })));

    if (opts.notifyClient !== false && c?.email && event !== "cancelled") {
      await sendUserEmail({ to: c.email, ...clientConfirmationEmail(details, manageUrl(appointmentId), event) });
    }
  } catch (err) {
    console.error("[obavijest o terminu]", err);
    Sentry.captureException(err, { tags: { area: "booking-notify" } });
  }
}

/**
 * Obavijest poslije odgovora (Next `after`). Van zahtjeva (testovi, skripte) se
 * preskače u testovima, a inače šalje u pozadini.
 */
export function notifyBookingLater(...args: Parameters<typeof notifyBooking>) {
  try {
    after(() => notifyBooking(...args));
  } catch {
    if (!process.env.VITEST) void notifyBooking(...args);
  }
}
