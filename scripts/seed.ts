/**
 * Demo podaci za lokalni razvoj: salon, radnici, usluge i termini za ovu sedmicu.
 *
 *   npm run db:seed
 *
 * Test nalog (samo lokalno):  demo@rokovnik.test / demo12345
 * Skripta briše i ponovo pravi demo salon, ostale podatke ne dira.
 */
import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/server/db/client";
import { account, salonMembers, salons, user } from "../src/server/db/schema";
import { addDays, toLocalDate, zonedToUtc } from "../src/server/domain/time";
import { createAppointment, getAvailability } from "../src/server/services/booking";
import { saveService } from "../src/server/services/catalog";
import { saveStaff, type Shift } from "../src/server/services/staff";

const DEMO_EMAIL = "demo@rokovnik.test";
const DEMO_PASSWORD = "demo12345";
const SLUG = "studio-lana";
const TZ = "Europe/Sarajevo";

const h = (hhmm: string) => {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
};
const week = (days: number[], from: string, to: string): Shift[] =>
  days.map((weekday) => ({ weekday, week: 0, startMin: h(from), endMin: h(to) }));

async function main() {
  // Korisnik
  let demo = await db.query.user.findFirst({ where: eq(user.email, DEMO_EMAIL) });
  if (!demo) {
    const id = crypto.randomUUID();
    [demo] = await db.insert(user).values({ id, name: "Lana Hadžić", email: DEMO_EMAIL, emailVerified: true }).returning();
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(DEMO_PASSWORD),
      updatedAt: new Date(),
    });
  }

  // Salon (ispočetka)
  await db.delete(salons).where(eq(salons.slug, SLUG));
  const [salon] = await db
    .insert(salons)
    .values({
      slug: SLUG,
      name: "Studio Lana",
      city: "Sarajevo",
      address: "Ferhadija 12",
      phone: "+38761234567",
      about: "Frizerski i kozmetički studio u srcu Baščaršije. Šišanje, boja, nokti i njega lica.",
      timezone: TZ,
    })
    .returning();
  await db.insert(salonMembers).values({ salonId: salon.id, userId: demo.id, role: "owner" });

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
  const selma = await mkStaff("Selma", "Kozmetičarka", "kadulja", [...week([1, 2, 3, 4, 5], "10:00", "18:00")]);

  // Usluge
  const svc = (categoryName: string, name: string, durationMin: number, price: number, staffIds: string[], extra = {}) =>
    saveService(salon.id, null, { categoryName, name, durationMin, price, staffIds, ...extra });

  const zensko = await svc("Žene", "Žensko šišanje", 45, 30, [lana, amra]);
  const feniranje = await svc("Žene", "Feniranje", 30, 15, [lana, amra]);
  const izrastak = await svc("Žene", "Farbanje izrastka", 90, 60, [lana, amra], { priceFrom: true, bufferMin: 15 });
  await svc("Žene", "Pramenovi", 150, 120, [amra], { priceFrom: true, bufferMin: 15 });
  await svc("Žene", "Svečana frizura", 60, 45, [lana, amra], { bookableOnline: false });
  const musko = await svc("Muškarci", "Muško šišanje", 30, 15, [dino, lana]);
  const brada = await svc("Muškarci", "Brada", 20, 10, [dino]);
  await svc("Muškarci", "Šišanje i brada", 45, 22, [dino]);
  const gel = await svc("Nokti", "Gel lak", 60, 35, [selma]);
  await svc("Nokti", "Manikir", 45, 25, [selma]);
  const lice = await svc("Lice i obrve", "Čišćenje lica", 75, 60, [selma], { bufferMin: 10 });
  const obrve = await svc("Lice i obrve", "Oblikovanje obrva", 20, 10, [selma]);

  // Termini za danas i narednih 5 dana
  const today = toLocalDate(new Date(), TZ);
  const book = async (dayOffset: number, time: string, serviceIds: string[], staffId: string, name: string, phone: string, source: "dashboard" | "online" | "instagram" | "voice" = "dashboard") => {
    const date = addDays(today, dayOffset);
    const startsAt = zonedToUtc(date, h(time), TZ);
    // Upisujemo samo termine koji padaju u radno vrijeme radnika
    const [day] = await getAvailability(salon, { serviceIds, staffId, from: date }, { mode: "staff" });
    if (!day.slots.some((sl) => sl.start === startsAt.toISOString())) { if (process.env.SEED_DEBUG) console.log("skip", date, time, name, day.slots.length, day.slots.slice(0, 3).map((s) => s.start)); return; }
    try {
      await createAppointment(
        salon,
        { serviceIds, staffId, startsAt, client: { name, phone }, source },
        { mode: "staff", userId: demo!.id },
      );
    } catch (err) {
      console.warn(`Preskočen termin ${date} ${time} (${name}):`, (err as Error).message);
    }
  };

  for (const d of [0, 1, 2, 3, 4, 5]) {
    await book(d, "09:00", [zensko], lana, "Merima Kovačević", "061 111 201", "online");
    await book(d, "10:00", [izrastak], lana, "Jasmina Begić", "062 333 404");
    await book(d, "12:15", [feniranje], lana, "Ajla Mujić", "061 555 606", "instagram");
    await book(d, "13:30", [zensko, feniranje], amra, "Nermina Delić", "065 777 808");
    await book(d, "16:00", [izrastak], amra, "Sanela Hodžić", "061 222 909", "voice");
    await book(d, "10:00", [musko], dino, "Haris Softić", "062 101 010");
    await book(d, "10:30", [musko, brada], dino, "Adnan Ibrahimović", "061 202 020", "online");
    await book(d, "11:30", [brada], dino, "Emir Halilović", "063 303 030");
    await book(d, "14:00", [musko], dino, "Tarik Čengić", "061 404 040", "instagram");
    await book(d, "10:30", [gel], selma, "Lejla Hasanović", "061 505 050", "online");
    await book(d, "12:00", [lice], selma, "Dženana Omerović", "062 606 060");
    await book(d, "15:00", [obrve], selma, "Amila Pašić", "061 707 070", "voice");
  }

  console.log(`Demo salon: /s/${SLUG}`);
  console.log(`Prijava: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
