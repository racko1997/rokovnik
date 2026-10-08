// Klijent upravlja svojim terminom preko potpisanog linka (potvrda, mail, AI chat).
// Ista pravila kao online zakazivanje; ownership dokazuje link, pa broj telefona
// uzimamo iz samog termina i koristimo postojeće radnje klijenta.
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { appointmentItems, appointments, clients, salons, staff } from "../../db/schema";
import { zonedToUtc } from "../../domain/time";
import { DomainError } from "../../errors";
import type { Salon } from "../salons";
import { cancelByClient, rescheduleByClient } from "./client";
import type { Status } from "./shared";

const MIN = 60_000;

export interface ManagedAppointment {
  id: string;
  salon: Salon;
  status: Status;
  startsAt: Date;
  endsAt: Date;
  clientName: string | null;
  services: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  /** Može li klijent sam otkazati/pomjeriti (dovoljno vremena prije termina, nije prošao ni otkazan) */
  canChange: boolean;
  /** Zašto ne može — za poruku na stranici */
  blockedReason: "past" | "cancelled" | "too_late" | "no_phone" | null;
}

export async function getManagedAppointment(appointmentId: string, now = new Date()): Promise<ManagedAppointment | null> {
  const [row] = await db
    .select({ appt: appointments, salon: salons, clientName: clients.name, clientPhone: clients.phone })
    .from(appointments)
    .innerJoin(salons, eq(salons.id, appointments.salonId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.id, appointmentId));
  if (!row) return null;

  const items = await db
    .select({ serviceId: appointmentItems.serviceId, serviceName: appointmentItems.serviceName, staffId: staff.id, staffName: staff.name })
    .from(appointmentItems)
    .innerJoin(staff, eq(staff.id, appointmentItems.staffId))
    .where(and(eq(appointmentItems.appointmentId, appointmentId), eq(appointmentItems.part, 0)))
    .orderBy(asc(appointmentItems.startsAt));

  const services = [...new Map(items.map((i) => [i.serviceId, { id: i.serviceId, name: i.serviceName }])).values()];
  const staffList = [...new Map(items.map((i) => [i.staffId, { id: i.staffId, name: i.staffName }])).values()];

  const { appt, salon } = row;
  const blockedReason: ManagedAppointment["blockedReason"] =
    appt.status === "cancelled"
      ? "cancelled"
      : appt.startsAt <= now || appt.status === "completed" || appt.status === "no_show"
        ? "past"
        : appt.startsAt.getTime() - now.getTime() < salon.minLeadMin * MIN
          ? "too_late"
          : !row.clientPhone
            ? "no_phone"
            : null;

  return {
    id: appt.id,
    salon,
    status: appt.status,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    clientName: row.clientName,
    services,
    staff: staffList,
    canChange: blockedReason === null,
    blockedReason,
  };
}

async function requireChangeable(appointmentId: string) {
  const appt = await getManagedAppointment(appointmentId);
  if (!appt) throw new DomainError("NOT_FOUND", "Termin ne postoji.");
  if (appt.blockedReason === "too_late") {
    throw new DomainError("TOO_EARLY", "Do termina je ostalo premalo vremena za online promjenu. Pozovite salon.");
  }
  if (!appt.canChange) throw new DomainError("INVALID_INPUT", "Ovaj termin se više ne može mijenjati online.");
  const [c] = await db
    .select({ phone: clients.phone })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(eq(appointments.id, appointmentId));
  return { appt, phone: c.phone! };
}

export async function cancelManaged(appointmentId: string) {
  const { appt, phone } = await requireChangeable(appointmentId);
  await cancelByClient(appt.salon.id, appointmentId, phone, "Otkazao klijent preko linka");
  return appt;
}

/** Novo vrijeme kao lokalni datum i minute u vremenskoj zoni salona. */
export async function rescheduleManaged(appointmentId: string, at: { date: string; startMin: number }) {
  const { appt, phone } = await requireChangeable(appointmentId);
  const startsAt = zonedToUtc(at.date, at.startMin, appt.salon.timezone);
  const res = await rescheduleByClient(appt.salon, { appointmentId, phone, startsAt, staffId: appt.staff[0]?.id });
  return { appt, ...res };
}
