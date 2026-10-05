// Podaci za kalendar u dashboardu.
import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { appointmentItems, appointments, clients } from "../../db/schema";
import { type Source, type Status } from "./shared";

// ─── Pregled ─────────────────────────────────────────────────────────────────

export interface CalendarItem {
  itemId: string;
  appointmentId: string;
  staffId: string;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  /** 1 = nastavak usluge nakon vremena djelovanja */
  part: number;
  startsAt: Date;
  endsAt: Date;
  blockedUntil: Date;
  status: Status;
  /** Prva posjeta ovog klijenta u salonu */
  firstVisit: boolean;
  source: Source;
  notes: string | null;
  client: { id: string; name: string; phone: string | null } | null;
}

export async function listCalendar(salonId: string, from: Date, to: Date): Promise<CalendarItem[]> {
  const rows = await db
    .select({
      itemId: appointmentItems.id,
      appointmentId: appointmentItems.appointmentId,
      staffId: appointmentItems.staffId,
      serviceId: appointmentItems.serviceId,
      serviceName: appointmentItems.serviceName,
      priceCents: appointmentItems.priceCents,
      part: appointmentItems.part,
      startsAt: appointmentItems.startsAt,
      endsAt: appointmentItems.endsAt,
      blockedUntil: appointmentItems.blockedUntil,
      status: appointments.status,
      firstVisit: sql<boolean>`not exists (
        select 1 from ${appointments} prev
        where prev.client_id = ${appointments.clientId}
          and prev.starts_at < ${appointments.startsAt}
          and prev.status <> 'cancelled'
      )`,
      source: appointments.source,
      notes: appointments.notes,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(appointmentItems)
    .innerJoin(appointments, eq(appointments.id, appointmentItems.appointmentId))
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(eq(appointmentItems.salonId, salonId), lt(appointmentItems.startsAt, to), gt(appointmentItems.endsAt, from)),
    )
    .orderBy(asc(appointmentItems.startsAt));

  return rows.map(({ clientId, clientName, clientPhone, ...r }) => ({
    ...r,
    client: clientId ? { id: clientId, name: clientName!, phone: clientPhone } : null,
  }));
}
