import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, OPERATOR } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  description: `Koje podatke ${APP_NAME} čuva, zašto, gdje i koliko dugo — za salone i njihove klijente.`,
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Politika privatnosti</h1>
      <p className="lead">
        Kratko i jasno: koje podatke čuvamo, zašto, gdje i koliko dugo. Važi od 8. oktobra 2026.
      </p>

      <h2>Ko smo</h2>
      <p>
        {APP_NAME} je aplikacija za zakazivanje termina i AI recepcioner za frizerske i kozmetičke salone.
        {OPERATOR.name ? ` Uslugu pruža ${OPERATOR.name}.` : ""}
        {OPERATOR.email ? (
          <>
            {" "}
            Za sva pitanja o podacima pišite na <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
          </>
        ) : (
          <>
            {" "}
            Za sva pitanja o podacima javite nam se preko <Link href="/#pilot">forme na naslovnoj</Link>.
          </>
        )}
      </p>
      <p>
        Postoje dvije vrste korisnika, pa i dvije uloge:
      </p>
      <ul>
        <li>
          <strong>Saloni</strong> (vlasnici, menadžeri, radnici) otvaraju nalog kod nas — za te podatke mi odlučujemo kako se koriste.
        </li>
        <li>
          <strong>Klijenti salona</strong> zakazuju termin u određenom salonu. Njihove podatke salon unosi i koristi za svoj posao — salon
          je za njih odgovoran, a mi ih čuvamo i obrađujemo samo po njegovom nalogu, da bi zakazivanje radilo.
        </li>
      </ul>

      <h2>Koje podatke čuvamo</h2>
      <ul>
        <li>
          <strong>Nalog salona:</strong> ime, email, lozinka (samo u šifrovanom obliku — niko je ne može pročitati), uloga u salonu.
        </li>
        <li>
          <strong>Podaci salona:</strong> naziv, adresa, telefon, usluge, cijene, radnici i radno vrijeme.
        </li>
        <li>
          <strong>Klijenti salona:</strong> ime, broj telefona, email ako ga ostave, termini, napomene uz termin i bilješke koje salon
          sam upiše.
        </li>
        <li>
          <strong>Razgovori s AI recepcionerom:</strong> poruke koje klijent napiše i odgovori recepcionera, da salon vidi šta je
          dogovoreno.
        </li>
        <li>
          <strong>Prijave za pilot program:</strong> podaci koje ostavite u formi na naslovnoj.
        </li>
        <li>
          <strong>Tehnički podaci:</strong> zapisi o greškama i osnovna, anonimna statistika posjeta (bez kolačića i bez praćenja kroz
          druge stranice).
        </li>
      </ul>

      <h2>Zašto ih koristimo</h2>
      <ul>
        <li>da salon vodi raspored, a klijent zakaže, pomjeri ili otkaže termin;</li>
        <li>da salonu javimo za novi, pomjeren ili otkazan termin, a klijentu pošaljemo potvrdu;</li>
        <li>da AI recepcioner odgovori po cjenovniku i stvarnim slobodnim terminima salona;</li>
        <li>da aplikacija bude sigurna i da popravimo greške.</li>
      </ul>
      <p>
        Podatke <strong>ne prodajemo</strong>, ne koristimo za reklame i ne dijelimo s drugim salonima. Klijenti jednog salona nisu
        vidljivi drugom.
      </p>

      <h2>Gdje su podaci i ko nam pomaže</h2>
      <p>Koristimo provjerene pružaoce usluga, svakog samo za ono što mora:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — baza podataka, serveri u Irskoj (EU).
        </li>
        <li>
          <strong>Vercel</strong> — rad aplikacije, serveri u Irskoj (EU).
        </li>
        <li>
          <strong>OpenAI</strong> — obrada poruka AI recepcionera. Poruke se šalju samo da bi se napisao odgovor i ne koriste se za
          treniranje modela; radi sprječavanja zloupotrebe OpenAI ih može čuvati najviše 30 dana, pa ih briše.
        </li>
        <li>
          <strong>Resend</strong> — slanje mailova (potvrde, obavijesti, nova lozinka).
        </li>
        <li>
          <strong>Sentry</strong> — zapisi o greškama u aplikaciji.
        </li>
      </ul>

      <h2>Koliko dugo</h2>
      <ul>
        <li>Podaci salona i njegovih klijenata čuvaju se dok salon koristi {APP_NAME}.</li>
        <li>
          Kad salon zatvori nalog, brišemo njegove podatke u roku od 30 dana. Salon prije toga može zatražiti izvoz svojih podataka.
        </li>
        <li>Zapisi o greškama brišu se automatski nakon najviše 90 dana.</li>
      </ul>

      <h2>Kolačići</h2>
      <p>
        Koristimo samo kolačić koji je neophodan da biste ostali prijavljeni u nalog salona. Klijenti koji zakazuju termin ne dobijaju
        kolačiće za praćenje. Statistika posjeta je anonimna i radi bez kolačića.
      </p>

      <h2>Vaša prava</h2>
      <p>
        Možete tražiti uvid u svoje podatke, ispravku, brisanje ili izvoz, i možete se usprotiviti obradi. <strong>Klijenti salona</strong>{" "}
        se mogu obratiti direktno salonu (on vidi i uređuje podatke) ili nama — proslijedićemo zahtjev salonu i pomoći da se izvrši.
        Ako mislite da se s vašim podacima ne postupa ispravno, možete se obratiti i Agenciji za zaštitu ličnih podataka u BiH.
      </p>

      <h2>Sigurnost</h2>
      <p>
        Veza je uvijek šifrovana (HTTPS), lozinke se čuvaju samo u šifrovanom obliku, a pristup podacima salona imaju samo ljudi koje
        salon sam doda, s ovlaštenjima koja im salon dodijeli.
      </p>

      <h2>Promjene</h2>
      <p>
        Ako promijenimo ovu politiku, novu verziju objavljujemo ovdje s datumom, a o većim promjenama obavještavamo salone mailom.
        Pogledajte i <Link href="/uslovi">Uslove korištenja</Link>.
      </p>
    </>
  );
}
