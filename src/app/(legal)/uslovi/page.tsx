import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, OPERATOR } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Uslovi korištenja",
  description: `Pravila korištenja aplikacije ${APP_NAME} za salone i njihove klijente.`,
};

export default function TermsPage() {
  return (
    <>
      <h1>Uslovi korištenja</h1>
      <p className="lead">Pravila za salone koji koriste {APP_NAME} i za klijente koji preko njega zakazuju. Važe od 8. oktobra 2026.</p>

      <h2>Usluga</h2>
      <p>
        {APP_NAME} salonima daje kalendar, online zakazivanje preko linka i AI recepcionera koji klijentima odgovara na poruke.
        {OPERATOR.name ? ` Uslugu pruža ${OPERATOR.name}.` : ""} Otvaranjem naloga ili zakazivanjem termina prihvatate ove uslove i{" "}
        <Link href="/privatnost">Politiku privatnosti</Link>.
      </p>

      <h2>Pilot program</h2>
      <p>
        Dok traje pilot program, {APP_NAME} je za salone besplatan, bez ugovora i kartice. Usluga se stalno razvija, pa se mogućnosti
        mogu mijenjati. Prije uvođenja plaćanja salone obavještavamo na vrijeme, a nastavak korištenja nakon toga je isključivo njihov
        izbor.
      </p>

      <h2>Nalog salona</h2>
      <ul>
        <li>Podaci pri otvaranju naloga moraju biti tačni, a lozinka tajna. Za radnje iz naloga odgovoran je salon.</li>
        <li>Salon sam odlučuje koga dodaje u nalog i s kojim ovlaštenjima.</li>
        <li>
          Salon je odgovoran da podatke svojih klijenata unosi i koristi zakonito — za zakazivanje i komunikaciju o terminima.
        </li>
      </ul>

      <h2>AI recepcioner</h2>
      <p>
        Recepcioner odgovara na osnovu cjenovnika, radnika i radnog vremena koje salon unese, a slobodne termine provjerava u
        kalendaru — ne izmišlja ih. Ipak, kao i svaki automatski sistem, može pogriješiti u razumijevanju poruke. Salon zato treba
        držati podatke tačnim i povremeno pregledati razgovore; za pitanja koja ne zna, recepcioner razgovor prebacuje salonu.
      </p>

      <h2>Zakazivanje za klijente</h2>
      <ul>
        <li>Termin zakazujete direktno kod salona; {APP_NAME} je samo alat preko kojeg to radite.</li>
        <li>
          Termin možete otkazati ili pomjeriti preko linka iz potvrde, u roku koji odredi salon. Kasnije promjene dogovarate direktno sa
          salonom.
        </li>
        <li>Cijene, trajanje i kvalitet usluge su stvar salona.</li>
      </ul>

      <h2>Šta nije dozvoljeno</h2>
      <ul>
        <li>lažna zakazivanja, slanje neželjenih poruka ili zloupotreba AI recepcionera;</li>
        <li>pokušaji pristupa tuđim nalozima ili podacima;</li>
        <li>korištenje usluge za bilo šta nezakonito.</li>
      </ul>
      <p>U takvim slučajevima možemo ograničiti ili ugasiti pristup.</p>

      <h2>Dostupnost i odgovornost</h2>
      <p>
        Trudimo se da {APP_NAME} radi bez prekida i da podaci budu sigurni i redovno čuvani. Ipak, ne možemo garantovati da prekida
        nikad neće biti. U mjeri u kojoj zakon dozvoljava, ne odgovaramo za indirektnu štetu (npr. izgubljenu zaradu) nastalu zbog
        prekida rada ili greške u podacima koje je unio salon.
      </p>

      <h2>Prestanak korištenja</h2>
      <p>
        Salon može prestati koristiti {APP_NAME} kad god želi i zatražiti izvoz ili brisanje svojih podataka. Podatke brišemo u roku od
        30 dana od zatvaranja naloga.
      </p>

      <h2>Promjene i pravo</h2>
      <p>
        O promjenama ovih uslova salone obavještavamo mailom prije nego što stupe na snagu. Na ove uslove primjenjuje se pravo Bosne i
        Hercegovine.
      </p>
      <p>
        {OPERATOR.email ? (
          <>
            Pitanja: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
          </>
        ) : (
          <>
            Pitanja: javite nam se preko <Link href="/#pilot">forme na naslovnoj</Link>.
          </>
        )}
      </p>
    </>
  );
}
