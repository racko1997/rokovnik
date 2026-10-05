// Radnje klijenta (preko AI recepcionera): pregled, otkazivanje i pomjeranje svojih termina.
import { normalizePhone } from "@/lib/phone";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { appointmentItems, appointments, clients } from "../../db/schema";
import { addDays, toLocalDate } from "../../domain/time";
import { DomainError } from "../../errors";
import type { Salon } from "../salons";
import { loadBlock, moveAppointment } from "./move";
import {
  allFree,
  bookingWindow,
  eligibleStaffIds,
  loadServices,
  loadStaffDays,
  segmentIntervals,
  type Status,
} from "./shared";
import { setAppointmentStatus } from "./status";

// ─── Termini klijenta (za AI recepcionera) ───────────────────────────────────

export interface ClientAppointment {
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  status: Status;
  services: string[];
  staffIds: string[];
}

/** Budući termini klijenta s tim brojem telefona. */
export async function listUpcomingByPhone(salonId: string, phoneInput: string, now = new Date()): Promise<ClientAppointment[]> {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw new DomainError("INVALID_INPUT", "Broj telefona nije ispravan.");
  const rows = await db
    .select({
      appointmentId: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      serviceName: appointmentItems.serviceName,
      staffId: appointmentItems.staffId,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .innerJoin(appointmentItems, eq(appointmentItems.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.salonId, salonId),
        eq(clients.phone, phone),
        gt(appointments.startsAt, now),
        inArray(appointments.status, ["booked", "confirmed"]),
      ),
    )
    .orderBy(asc(appointments.startsAt), asc(appointmentItems.startsAt));

  const byId = new Map<string, ClientAppointment>();
  for (const r of rows) {
    const a = byId.get(r.appointmentId) ?? {
      appointmentId: r.appointmentId, startsAt: r.startsAt, endsAt: r.endsAt, status: r.status, services: [], staffIds: [],
    };
    if (!a.services.includes(r.serviceName)) a.services.push(r.serviceName);
    if (!a.staffIds.includes(r.staffId)) a.staffIds.push(r.staffId);
    byId.set(r.appointmentId, a);
  }
  return [...byId.values()];
}

/** Otkazivanje od strane klijenta: termin mora pripadati tom broju telefona. */
export async function cancelByClient(salonId: string, appointmentId: string, phoneInput: string, reason?: string) {
  const own = await listUpcomingByPhone(salonId, phoneInput);
  if (!own.some((a) => a.appointmentId === appointmentId)) {
    throw new DomainError("NOT_FOUND", "Nema budućeg termina s tim brojem telefona.");
  }
  await setAppointmentStatus(salonId, appointmentId, "cancelled", { reason: reason ?? "Otkazao klijent" });
}

// ─── Pomjeranje termina na zahtjev klijenta (AI recepcioner) ────────────────

/**
 * Klijent pomjera svoj termin: isti broj telefona, nova pravila kao za online
 * zakazivanje (radno vrijeme, minimalni razmak, slobodan radnik). Termin se
 * premješta — ne pravi se novi, pa nema duplih rezervacija.
 */
export async function rescheduleByClient(
  salon: Salon,
  input: { appointmentId: string; phone: string; startsAt: Date; staffId?: string },
  opts: { now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const own = await listUpcomingByPhone(salon.id, input.phone, now);
  const appt = own.find((a) => a.appointmentId === input.appointmentId);
  if (!appt) throw new DomainError("NOT_FOUND", "Nema budućeg termina s tim brojem telefona.");
  if (appt.staffIds.length !== 1) {
    throw new DomainError("INVALID_INPUT", "Ovaj termin ima više radnika — pomjeranje dogovorite sa salonom.");
  }
  const fromStaffId = appt.staffIds[0];
  const items = await loadBlock(salon.id, input.appointmentId, fromStaffId);
  const serviceIds = [...new Set(items.map((i) => i.serviceId))];
  const list = await loadServices(db, salon.id, serviceIds, "public");

  const start = input.startsAt.getTime();
  const { earliest, lastDate } = bookingWindow(salon, "public", now);
  const date = toLocalDate(input.startsAt, salon.timezone);
  if (earliest !== undefined && start < earliest) {
    throw new DomainError("TOO_EARLY", "Taj termin je prekasno za online promjenu. Odaberite kasniji.");
  }
  if (lastDate && date > lastDate) {
    throw new DomainError("TOO_FAR", `Termine je moguće zakazati najviše ${salon.maxAdvanceDays} dana unaprijed.`);
  }

  const candidates = await eligibleStaffIds(db, salon.id, serviceIds, "public", input.staffId);
  // Postojeći radnik ima prednost, pa ostali redom
  const ordered = [fromStaffId, ...candidates.filter((id) => id !== fromStaffId)].filter((id) => candidates.includes(id));
  if (!ordered.length) throw new DomainError("STAFF_CANT_DO_SERVICE", "Taj radnik ne radi ovu uslugu.");

  const days = await loadStaffDays(db, salon, ordered, date, 2, input.appointmentId);
  const staffDays = [...(days.get(date) ?? []), ...(days.get(addDays(date, 1)) ?? [])];
  const intervals = segmentIntervals(list, start);
  const free = ordered.filter((id) => staffDays.filter((d) => d.staffId === id).some((d) => allFree(d, intervals)));
  if (!free.length) throw new DomainError("SLOT_TAKEN", "Taj termin nije slobodan. Odaberite drugi.");

  await moveAppointment(salon, { appointmentId: input.appointmentId, fromStaffId, toStaffId: free[0], startsAt: input.startsAt });
  return { staffId: free[0], startsAt: input.startsAt, endsAt: new Date(start + (items.at(-1)!.endsAt.getTime() - items[0].startsAt.getTime())) };
}
