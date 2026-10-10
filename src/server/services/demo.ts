// Demo salon "Studio Lana": radnici, usluge, tri sedmice prošlih posjeta i termini za
// narednih 5 dana. Koriste ga dvije stvari:
//  - javni demo (/s/studio-lana, "Probaj kao klijent") — obnavlja ga `npm run db:seed`
//    lokalno ili admin dugme u produkciji (vlasnik tada ima nasumičnu lozinku);
//  - probni salon ("Isprobaj bez registracije") — svaki posjetilac dobija svoju kopiju
//    s privremenim nalogom, koja se briše nakon 24 sata.
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, gte, inArray, isNotNull, like, lt, sql } from "drizzle-orm";
import { normalizePhone } from "@/lib/phone";
import { db } from "../db/client";
import { account, appointmentItems, appointments, clients, salonMembers, salons, services, user } from "../db/schema";
import { addDays, toLocalDate, zonedToUtc } from "../domain/time";
import { DomainError } from "../errors";
import type { Source, Status } from "./booking";
import { saveService } from "./catalog";
import { loadSchedules } from "./schedule";
import { saveStaff, type Shift } from "./staff";

export const DEMO_EMAIL = "demo@rokovnik.test";
export const DEMO_SLUG = "studio-lana";
/** Probni nalozi: domena .test nikad ne prima mail, pa se ništa ne šalje na izmišljene adrese */
export const SANDBOX_EMAIL_DOMAIN = "proba.rokovnik.test";
export const SANDBOX_HOURS = 24;
/** Najviše novih probnih salona na sat za cijelu aplikaciju (zaštita od zloupotrebe) */
const SANDBOX_HOURLY_CAP = 60;

const TZ = "Europe/Sarajevo";
const MIN = 60_000;
const PAST_DAYS = 21;
const FUTURE_DAYS = 5;

const h = (hhmm: string) => {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
};
const week = (days: number[], from: string, to: string): Shift[] =>
  days.map((weekday) => ({ weekday, week: 0, startMin: h(from), endMin: h(to) }));

/** Pravi kompletan demo salon za vlasnika `ownerId`. */
async function buildDemoSalon(opts: { slug: string; ownerId: string; sandboxExpiresAt?: Date }) {
  const [salon] = await db
    .insert(salons)
    .values({
      slug: opts.slug,
      name: "Studio Lana",
      city: "Sarajevo",
      address: "Ferhadija 12",
      phone: "+38761234567",
      about: "Frizerski i kozmetički studio u srcu Baščaršije. Šišanje, boja, nokti i njega lica.",
      timezone: TZ,
      sandboxExpiresAt: opts.sandboxExpiresAt ?? null,
    })
    .returning();
  await db.insert(salonMembers).values({ salonId: salon.id, userId: opts.ownerId, role: "owner" });

  // Radnici (usluge dodajemo poslije)
  const mkStaff = (name: string, title: string, color: string, hours: Shift[]) =>
    saveStaff(salon.id, null, { name, title, color, hours, serviceIds: [] });

  const lana = await mkStaff("Lana", "Vlasnica, frizerka", "rubin", [
    ...week([1, 2, 3, 4, 5], "09:00", "17:00"),
    ...week([6], "09:00", "14:00"),
  ]);
  const amra = await mkStaff("Amra", "Frizerka, kolorist", "ljubicasta", [
    ...week([1, 3, 5], "12:00", "20:00"),
    ...week([2, 4], "09:00", "13:00"),
    ...week([2, 4], "14:00", "18:00"),
    ...week([6], "09:00", "15:00"),
  ]);
  const dino = await mkStaff("Dino", "Barber", "plavocrna", [...week([1, 2, 3, 4, 5, 6], "10:00", "18:00")]);
  const ana = await mkStaff("Ana", "Kozmetičarka", "kadulja", [...week([1, 2, 3, 4, 5], "10:00", "18:00")]);

  // Usluge
  const svc = (categoryName: string, name: string, durationMin: number, price: number, staffIds: string[], extra = {}) =>
    saveService(salon.id, null, { categoryName, name, durationMin, price, staffIds, ...extra });

  const zensko = await svc("Žene", "Žensko šišanje", 45, 30, [lana, amra]);
  const feniranje = await svc("Žene", "Feniranje", 30, 15, [lana, amra]);
  // Boja djeluje 30 min — radnica tada može raditi drugu klijenticu
  const izrastak = await svc("Žene", "Farbanje izrastka", 90, 60, [lana, amra], { priceFrom: true, bufferMin: 10, gapStartMin: 30, gapMin: 30 });
  await svc("Žene", "Pramenovi", 150, 120, [amra], { priceFrom: true, bufferMin: 10, gapStartMin: 45, gapMin: 35 });
  await svc("Žene", "Svečana frizura", 60, 45, [lana, amra], { bookableOnline: false });
  const musko = await svc("Muškarci", "Muško šišanje", 30, 15, [dino, lana]);
  const brada = await svc("Muškarci", "Brada", 20, 10, [dino]);
  await svc("Muškarci", "Šišanje i brada", 45, 22, [dino]);
  const gel = await svc("Nokti", "Gel lak", 60, 35, [ana]);
  await svc("Nokti", "Manikir", 45, 25, [ana]);
  const lice = await svc("Lice i obrve", "Čišćenje lica", 75, 60, [ana], { bufferMin: 10 });
  const obrve = await svc("Lice i obrve", "Oblikovanje obrva", 20, 10, [ana]);

  // Termini: raspored po šablonu (bez preklapanja kod istog radnika), samo unutar smjena.
  // Sve se upisuje skupno — isti raspored stavki kao pravo zakazivanje, ali u par upita.
  const today = toLocalDate(new Date(), TZ);
  const now = Date.now();
  const from = addDays(today, -PAST_DAYS);
  const schedules = await loadSchedules(db, [lana, amra, dino, ana], from, PAST_DAYS + FUTURE_DAYS + 1);
  const catalog = new Map((await db.select().from(services).where(eq(services.salonId, salon.id))).map((s) => [s.id, s]));
  const visits: { startsAt: Date; serviceIds: string[]; staffId: string; name: string; phone: string; source: Source; status: Status }[] = [];
  let seq = 0;
  // Ponovljiva "slučajnost" — isti demo svaki put; `salt` razdvaja odluke da ne zavise jedna od druge
  const chance = (n: number, salt: number) => (((seq * 2654435761) ^ (salt * 40503)) >>> 0) % 100 < n;

  const book = (dayOffset: number, time: string, serviceIds: string[], staffId: string, name: string, phone: string, source: Source = "dashboard") => {
    seq++;
    const date = addDays(today, dayOffset);
    const startsAt = zonedToUtc(date, h(time), TZ);
    const past = startsAt.getTime() <= now;
    // Prošlost nije baš svaki dan ista; budućnost je malo rjeđa (ima mjesta za nove termine)
    if (chance(past ? 25 : 35, 1)) return;
    const shifts = schedules.get(staffId)?.get(date)?.shifts ?? [];
    if (!shifts.some((sh) => sh.startMin <= h(time) && h(time) + 30 <= sh.endMin)) return;
    const status: Status = past ? (chance(6, 2) ? "no_show" : chance(5, 3) ? "cancelled" : "completed") : chance(40, 4) ? "confirmed" : "booked";
    visits.push({ startsAt, serviceIds, staffId, name, phone, source, status });
  };

  for (let d = -PAST_DAYS; d <= FUTURE_DAYS; d++) {
    book(d, "09:00", [zensko], lana, "Milica Kovačević", "061 111 201", "online");
    book(d, "10:00", [izrastak], lana, "Jasmina Begić", "062 333 404");
    book(d, "10:30", [feniranje], lana, "Ivana Marić", "062 909 101", "online");
    book(d, "12:15", [feniranje], lana, "Ajla Mujić", "061 555 606", "instagram");
    book(d, "13:30", [zensko, feniranje], amra, "Jelena Đurić", "065 777 808");
    book(d, "16:00", [izrastak], amra, "Sanela Hodžić", "061 222 909", "voice");
    book(d, "10:00", [musko], dino, "Haris Softić", "062 101 010");
    book(d, "10:30", [musko, brada], dino, "Nikola Petrović", "061 202 020", "online");
    book(d, "11:30", [brada], dino, "Marko Barišić", "063 303 030");
    book(d, "14:00", [musko], dino, "Luka Vuković", "061 404 040", "instagram");
    book(d, "10:30", [gel], ana, "Lejla Hasanović", "061 505 050", "online");
    book(d, "12:00", [lice], ana, "Maja Knežević", "062 606 060");
    book(d, "15:00", [obrve], ana, "Tamara Popović", "061 707 070", "voice");
  }
  if (!visits.length) return salon;

  const people = [...new Map(visits.map((v) => [normalizePhone(v.phone)!, v.name])).entries()];
  const created = await db
    .insert(clients)
    .values(people.map(([phone, name]) => ({ salonId: salon.id, name, phone })))
    .returning({ id: clients.id, phone: clients.phone });
  const clientId = new Map(created.map((c) => [c.phone, c.id]));

  const apptRows: (typeof appointments.$inferInsert)[] = [];
  const itemRows: (typeof appointmentItems.$inferInsert)[] = [];
  for (const v of visits) {
    const id = crypto.randomUUID();
    let cursor = v.startsAt.getTime();
    for (const sid of v.serviceIds) {
      const sv = catalog.get(sid)!;
      const base = { appointmentId: id, salonId: salon.id, staffId: v.staffId, serviceId: sid, serviceName: sv.name, active: v.status !== "cancelled" };
      const itemStart = cursor;
      const itemEnd = itemStart + sv.durationMin * MIN;
      cursor = itemEnd + sv.bufferMin * MIN;
      if (sv.gapMin > 0) {
        const gapStart = itemStart + sv.gapStartMin * MIN;
        itemRows.push({ ...base, priceCents: sv.priceCents, part: 0, startsAt: new Date(itemStart), endsAt: new Date(gapStart), blockedUntil: new Date(gapStart) });
        itemRows.push({ ...base, priceCents: 0, part: 1, startsAt: new Date(gapStart + sv.gapMin * MIN), endsAt: new Date(itemEnd), blockedUntil: new Date(cursor) });
      } else {
        itemRows.push({ ...base, priceCents: sv.priceCents, part: 0, startsAt: new Date(itemStart), endsAt: new Date(itemEnd), blockedUntil: new Date(cursor) });
      }
    }
    apptRows.push({
      id,
      salonId: salon.id,
      clientId: clientId.get(normalizePhone(v.phone)!),
      status: v.status,
      source: v.source,
      startsAt: v.startsAt,
      endsAt: itemRows[itemRows.length - 1].endsAt,
      createdByUserId: opts.ownerId,
      cancelledAt: v.status === "cancelled" ? v.startsAt : null,
    });
  }
  await db.transaction(async (tx) => {
    await tx.insert(appointments).values(apptRows);
    await tx.insert(appointmentItems).values(itemRows);
  });
  return salon;
}

/** Javni demo: obnavlja Studio Lana. Lozinka se postavlja samo kad demo nalog još ne postoji. */
export async function resetDemoSalon(opts: { ownerPassword?: string } = {}) {
  let demo = await db.query.user.findFirst({ where: eq(user.email, DEMO_EMAIL) });
  if (!demo) {
    const id = crypto.randomUUID();
    [demo] = await db.insert(user).values({ id, name: "Lana Hadžić", email: DEMO_EMAIL, emailVerified: true }).returning();
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(opts.ownerPassword ?? randomBytes(24).toString("base64url")),
      updatedAt: new Date(),
    });
  }
  await db.delete(salons).where(eq(salons.slug, DEMO_SLUG));
  await buildDemoSalon({ slug: DEMO_SLUG, ownerId: demo.id });
  return { slug: DEMO_SLUG };
}

/** Podaci za probni nalog; sam nalog (i sesiju) pravi Better Auth u akciji. */
export async function prepareSandbox() {
  await deleteExpiredSandboxes();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(salons)
    .where(and(isNotNull(salons.sandboxExpiresAt), gte(salons.createdAt, new Date(Date.now() - 60 * MIN))));
  if (n >= SANDBOX_HOURLY_CAP) {
    throw new DomainError("INVALID_INPUT", "Trenutno je previše probnih salona. Pokušajte za koji minut ili otvorite svoj salon.");
  }
  const tag = randomBytes(5).toString("hex");
  return {
    tag,
    email: `proba-${tag}@${SANDBOX_EMAIL_DOMAIN}`,
    password: randomBytes(24).toString("base64url"),
  };
}

export async function createSandboxSalon(ownerId: string, tag: string) {
  return buildDemoSalon({ slug: `proba-${tag}`, ownerId, sandboxExpiresAt: new Date(Date.now() + SANDBOX_HOURS * 60 * MIN) });
}

/** Briše istekle probne salone i njihove probne naloge (samo naloge s probnom adresom). */
export async function deleteExpiredSandboxes() {
  const expired = await db
    .select({ id: salons.id })
    .from(salons)
    .where(and(isNotNull(salons.sandboxExpiresAt), lt(salons.sandboxExpiresAt, new Date())));
  if (!expired.length) return 0;
  const ids = expired.map((s) => s.id);
  const owners = await db.select({ userId: salonMembers.userId }).from(salonMembers).where(inArray(salonMembers.salonId, ids));
  await db.delete(salons).where(inArray(salons.id, ids));
  if (owners.length) {
    await db
      .delete(user)
      .where(and(inArray(user.id, owners.map((o) => o.userId)), like(user.email, `%@${SANDBOX_EMAIL_DOMAIN}`)));
  }
  return ids.length;
}
