// Podaci koje server šalje kalendaru. Sva vremena su lokalne minute od ponoći.

export type Status = "booked" | "confirmed" | "completed" | "cancelled" | "no_show";
export type Source = "dashboard" | "online" | "chat" | "instagram" | "messenger" | "whatsapp" | "viber" | "voice";
export type View = "dan" | "sedmica" | "lista";
export type ColorMode = "status" | "usluga" | "radnik";
export type Density = "udobno" | "zbijeno";

export interface CalStaff {
  id: string;
  name: string;
  title: string | null;
  color: string;
  serviceIds: string[];
}

/** Raspored jednog radnika jednog dana. */
export interface StaffDay {
  staffId: string;
  date: string;
  shifts: { startMin: number; endMin: number }[];
  /** Smjena tog dana je izmijenjena (nije redovni raspored). */
  isOverride: boolean;
  /** Salon ne radi tog dana (praznik) */
  closedReason: string | null;
  absences: { startMin: number; endMin: number; reason: string | null }[];
}

export interface CalItem {
  itemId: string;
  appointmentId: string;
  staffId: string;
  date: string;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  /** 1 = nastavak usluge nakon vremena djelovanja */
  part: number;
  startMin: number;
  endMin: number;
  blockedMin: number;
  status: Status;
  source: Source;
  notes: string | null;
  firstVisit: boolean;
  client: { id: string; name: string; phone: string | null } | null;
}

export interface CalService {
  id: string;
  name: string;
  categoryName: string | null;
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  priceFrom: boolean;
  staffIds: string[];
}

/** Jedna posjeta kod jednog radnika (spojene uzastopne usluge). */
export interface CalBlock {
  key: string;
  appointmentId: string;
  staffId: string;
  date: string;
  startMin: number;
  endMin: number;
  blockedMin: number;
  status: Status;
  source: Source;
  notes: string | null;
  firstVisit: boolean;
  client: CalItem["client"];
  services: { id: string; name: string; priceCents: number }[];
  /** Vrijeme djelovanja: rupe u kojima je radnik slobodan */
  gaps: { startMin: number; endMin: number }[];
}

export interface CalendarAlerts {
  unconfirmedTomorrow: number;
  conflictsAhead: number;
  handoffs: number;
}

export interface CalendarData {
  view: View;
  /** Dan koji se gleda (za sedmicu: bilo koji dan te sedmice) */
  date: string;
  /** Dani u prikazu (1 za dan i listu, 7 za sedmicu) */
  days: string[];
  today: string;
  nowMin: number;
  currency: string;
  staff: CalStaff[];
  staffDays: StaffDay[];
  items: CalItem[];
  services: CalService[];
  /** "appointmentId:staffId" blokova koji su van radnog vremena */
  conflictKeys: string[];
  alerts: CalendarAlerts;
  colorMode: ColorMode;
  density: Density;
  /** Filter radnika iz URL-a: "rade" (zadano), "svi" ili lista ID-jeva */
  staffFilter: string;
  /** Radnik za sedmični prikaz */
  weekStaffId: string | null;
  /** Kolona prijavljenog korisnika (ako je i sam radnik) */
  myStaffId: string | null;
  /** Vlasnik i menadžer vide prihod i cijene */
  canSeeRevenue: boolean;
}

export const SOURCE_LABEL: Record<Source, string | null> = {
  dashboard: null,
  online: "Online",
  chat: "AI chat",
  instagram: "Instagram",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  viber: "Viber",
  voice: "Poziv",
};

export const STATUS_LABEL: Record<Status, string> = {
  booked: "Zakazano",
  confirmed: "Potvrđeno",
  completed: "Završeno",
  cancelled: "Otkazano",
  no_show: "Nije došao/la",
};

export function toBlocks(items: CalItem[]): CalBlock[] {
  const groups = new Map<string, CalItem[]>();
  for (const i of items) {
    const key = `${i.appointmentId}:${i.staffId}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.startMin - b.startMin);
    const first = sorted[0];
    const gaps: CalBlock["gaps"] = [];
    for (let k = 1; k < sorted.length; k++) {
      const prevEnd = Math.max(...sorted.slice(0, k).map((x) => x.blockedMin));
      if (sorted[k].startMin > prevEnd) gaps.push({ startMin: prevEnd, endMin: sorted[k].startMin });
    }
    return {
      key,
      appointmentId: first.appointmentId,
      staffId: first.staffId,
      date: first.date,
      startMin: first.startMin,
      endMin: Math.max(...sorted.map((x) => x.endMin)),
      blockedMin: Math.max(...sorted.map((x) => x.blockedMin)),
      status: first.status,
      source: first.source,
      notes: first.notes,
      firstVisit: first.firstVisit,
      client: first.client,
      // Nastavak usluge nakon djelovanja nije nova usluga
      services: sorted.filter((x) => x.part === 0).map((x) => ({ id: x.serviceId, name: x.serviceName, priceCents: x.priceCents })),
      gaps,
    };
  });
}
