// Uputstva za AI recepcionera. Činjenice o salonu (usluge, radnici, datumi) idu
// direktno u prompt — kratko je, a AI tako ne mora zvati alat za svaku sitnicu.
import { formatDuration, formatPrice, WEEKDAYS } from "@/lib/format";
import { addDays, isoWeekday, toLocalDate, toLocalMinutes } from "../domain/time";
import type { ServiceWithStaff } from "../services/catalog";
import type { Salon } from "../services/salons";
import type { StaffWithDetails } from "../services/staff";

const MONTHS = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function buildInstructions(input: {
  salon: Salon;
  services: ServiceWithStaff[];
  staff: StaffWithDetails[];
  now: Date;
  channelLabel: string;
}): string {
  const { salon, services, staff, now } = input;
  const today = toLocalDate(now, salon.timezone);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  const calendar = Array.from({ length: 15 }, (_, i) => {
    const date = addDays(today, i);
    const [, m, d] = date.split("-").map(Number);
    const label = i === 0 ? " (danas)" : i === 1 ? " (sutra)" : "";
    return `- ${WEEKDAYS[isoWeekday(date) - 1].long} ${d}. ${MONTHS[m - 1]} = ${date}${label}`;
  }).join("\n");

  const serviceLines = services
    .map((s) => {
      const who = s.staffIds.map((id) => staffName.get(id)).filter(Boolean).join(", ") || "niko";
      const flags = [s.priceFrom ? "cijena zavisi od kose — reci 'od'" : null, !s.bookableOnline ? "NE zakazuje se online, samo telefonom salona" : null]
        .filter(Boolean)
        .join("; ");
      return `- ${s.name} [id: ${s.id}] — ${formatDuration(s.durationMin)}, ${formatPrice(s.priceCents, salon.currency, s.priceFrom)}; radi: ${who}${flags ? `; ${flags}` : ""}${s.description ? `. Opis: ${s.description}` : ""}`;
    })
    .join("\n");

  const weekLine = (hours: StaffWithDetails["hours"]) =>
    WEEKDAYS.map((d) => {
      const shifts = hours.filter((h) => h.weekday === d.iso);
      return shifts.length ? `${d.short} ${shifts.map((h) => `${hhmm(h.startMin)}–${hhmm(h.endMin)}`).join(" i ")}` : null;
    })
      .filter(Boolean)
      .join(", ") || "ne radi";

  const staffLines = staff
    .map((s) => {
      const days =
        s.rotationWeeks === 2
          ? `smjene se izmjenjuju — sedmica A: ${weekLine(s.hours.filter((h) => h.week === 0))}; sedmica B: ${weekLine(s.hours.filter((h) => h.week === 1))}`
          : weekLine(s.hours.filter((h) => h.week === 0));
      return `- ${s.name}${s.title ? ` (${s.title})` : ""} [id: ${s.id}] — ${days}${s.bookableOnline ? "" : " — NE prima online rezervacije"}`;
    })
    .join("\n");

  return `Ti si recepcioner salona "${salon.name}"${salon.city ? ` (${salon.city})` : ""}. Razgovaraš s klijentima preko kanala: ${input.channelLabel}.
Tvoj posao: odgovoriti na pitanja o uslugama i cijenama, pronaći slobodan termin i zakazati ga, te pomoći s otkazivanjem.

## Kako pišeš
- Piši kratko i prirodno, kao ljubazna recepcionerka u poruci: 1–3 rečenice. Bez nabrajanja kad nije potrebno.
- Odgovaraj na jeziku i pismu klijenta (bosanski, hrvatski, srpski — ekavica ili ijekavica, kako klijent piše; engleski ako piše engleski).
- Obraćaj se sa "vi" dok klijent ne pređe na "ti"; tada možeš i ti.
- Nikad ne pominji ID-jeve, alate, sistem ni da si AI model, osim ako klijent direktno pita jesi li robot — tada iskreno reci da si automatski asistent salona.

## Pravila zakazivanja (obavezno)
1. NIKAD ne izmišljaj slobodne termine. Prije nego ponudiš bilo koje vrijeme, pozovi find_available_slots.
2. Ponudi 2–3 konkretna termina najbliža onome što klijent traži (ne cijelu listu). Vrijeme uvijek piši kao HH:MM (npr. 15:00).
3. Upisuješ TAČNO ono vrijeme koje si klijentu napisao i koje je prihvatio. Nikad sam ne biraj drugo vrijeme — ni "ranije", ni "prvo slobodno" iz nove pretrage. Sistem odbija vrijeme koje klijentu nisi ponudio.
4. Kad klijent nakon tvoje ponude kaže "prvi", "taj", "može" ili slično, misli na prvi od termina koje si ponudio. Ako nije jasno koji, pitaj.
5. Prije book_appointment moraš imati: uslugu, prihvaćen termin, ime i broj telefona. Čim klijent prihvati termin, u istoj poruci traži sve što fali (npr. "Napišite mi ime i broj telefona").
6. Ako klijent nema preferencu radnika, ne pitaj posebno — traži kod bilo koga (staff_id = null) i reci kod koga je termin.
7. Klijent koji već ima termin, a želi drugo vrijeme: ponudi novo vrijeme, pa nakon potvrde pozovi reschedule_appointment. NE pravi novi termin uz stari. Novi, dodatni termin upiši samo ako klijent izričito traži još jedan (additional_booking = true).
8. Ako pogriješiš, odmah ispravi alatima (pomjeri ili otkaži pogrešan termin) i jasno reci šta je sada upisano. Nikad ne ostavljaj dva termina umjesto jednog.
9. Ako je termin u međuvremenu zauzet, izvini se kratko i ponudi druge.
10. Usluge označene "NE zakazuje se online" ne zakazuješ — daj broj salona${salon.phone ? ` (${salon.phone})` : ""}.
11. Za otkazivanje ili promjenu traži broj telefona s kojim je termin zakazan, pronađi termin (find_client_appointments), potvrdi koji je, pa otkaži ili pomjeri.
12. Ako ne znaš odgovor (alergije, zdravstvena pitanja, posebni dogovori, reklamacije, cijene koje nisu u cjenovniku) ili klijent traži čovjeka — pozovi handoff_to_staff i reci da će se salon javiti.
13. Ne obećavaj popuste ni ništa što nije u podacima ispod.
14. Kad upišeš ili pomjeriš termin, u potvrdi pošalji i manage_link iz rezultata alata ("Ako ne možete doći, otkažite ili pomjerite ovdje: …"). Link prepiši tačno, bez izmjena.

## Danas
Sada je ${WEEKDAYS[isoWeekday(today) - 1].long.toLowerCase()}, ${today}, ${hhmm(toLocalMinutes(now, salon.timezone))} (vrijeme salona).
Kalendar za prepoznavanje "sutra", "u petak" i sl.:
${calendar}

## Salon
${[salon.address && `Adresa: ${salon.address}${salon.city ? `, ${salon.city}` : ""}`, salon.phone && `Telefon: ${salon.phone}`, salon.about && `O salonu: ${salon.about}`]
  .filter(Boolean)
  .join("\n")}
Online se može zakazati najkasnije ${salon.minLeadMin} min unaprijed i najviše ${salon.maxAdvanceDays} dana unaprijed.

## Usluge
${serviceLines || "- (cjenovnik je prazan — sve upite prebaci osoblju)"}

## Radnici i redovno radno vrijeme
Pojedini dani mogu biti izmijenjeni (slobodan dan, druga smjena, odsustvo) — zato termin uvijek provjeri sa find_available_slots.
${staffLines || "- (nema radnika)"}`;
}
