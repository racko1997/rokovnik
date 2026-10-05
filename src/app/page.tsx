import { Check, ChevronDown, MessageCircle, Phone, PhoneMissed, Moon, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { HeroScene } from "@/components/landing/hero-scene";
import { PilotForm } from "@/components/landing/pilot-form";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { AgentVisual, BookingVisual, ShiftsVisual } from "@/components/landing/visuals";
import { ButtonLink } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${APP_NAME} — zakazivanje i AI recepcioner za salone`,
  description:
    "Kalendar za cijeli salon, online zakazivanje preko linka i AI recepcioner koji odgovara klijentima na poruke. Za frizerske i kozmetičke salone u BiH.",
};

const PAINS = [
  {
    icon: PhoneMissed,
    title: "Telefon zvoni dok radite",
    text: "Ruke su u farbi, klijentica čeka. Propušten poziv je često i propušten termin — klijent zove sljedeći salon.",
  },
  {
    icon: Moon,
    title: "Poruke stižu u 23 h",
    text: "Instagram i Viber pitanja „ima li sutra nešto?“ stižu kad salon ne radi, a odgovor se piše ujutro, u žurbi.",
  },
  {
    icon: UserX,
    title: "Raspored u glavi i svesci",
    text: "Neko uzme slobodan dan, a termini ostanu upisani. Dupli termini i zaboravljene promjene koštaju i vrijeme i klijente.",
  },
];

const CHANNELS = [
  { name: "Web chat na stranici salona", status: "Radi" },
  { name: "Online zakazivanje preko linka", status: "Radi" },
  { name: "Instagram i Facebook poruke", status: "Uskoro" },
  { name: "WhatsApp", status: "Uskoro" },
  { name: "Viber", status: "Uskoro" },
  { name: "Telefonski poziv (glasovni recepcioner)", status: "U razvoju" },
];

const FAQ = [
  {
    q: "Šta ako AI ne zna odgovor?",
    a: "Ne izmišlja. Za pitanja koja nisu u vašem cjenovniku ili rasporedu (alergije, posebni dogovori, reklamacije) prebacuje razgovor vama i kaže klijentu da će se salon javiti. Takvi razgovori su označeni u dashboardu.",
  },
  {
    q: "Može li se desiti da dvoje zakažu isti termin?",
    a: "Ne. Slobodne termine računa sistem, ne AI, a baza podataka odbija svako preklapanje kod istog radnika — i kad recepcija, online stranica i AI zakazuju u istoj sekundi.",
  },
  {
    q: "Moraju li klijenti instalirati aplikaciju?",
    a: "Ne. Zakazuju preko linka koji stavite u Instagram bio, na Google profil ili pošaljete porukom, odnosno pišu u poruke kao i do sada.",
  },
  {
    q: "Šta kad radnik uzme slobodan dan, a ima zakazane termine?",
    a: "Rokovnik vam pokaže pogođene termine i za svaki predloži ko je slobodan u isto vrijeme. Prebacite ga jednim klikom, pomjerite ili otkažite — ništa se ne briše samo.",
  },
  {
    q: "Radi li na telefonu?",
    a: "Da. Dashboard je napravljen i za telefon (lista termina dana), a stranica za zakazivanje je prvenstveno za mobitel, jer odatle klijenti najčešće zakazuju.",
  },
  {
    q: "Ko vidi podatke o mojim klijentima?",
    a: "Samo vi i vaše osoblje. Podaci su na serverima u EU i ne dijele se s drugim salonima.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <ScrollReveal />
      <header className="sticky top-0 z-40 border-b border-transparent bg-porcelain/85 backdrop-blur supports-[backdrop-filter]:bg-porcelain/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandMark />
          <nav className="flex items-center gap-1">
            <a href="#mogucnosti" className="hidden rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink md:block">
              Mogućnosti
            </a>
            <a href="#recepcioner" className="hidden rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink md:block">
              AI recepcioner
            </a>
            <a href="#pitanja" className="hidden rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink md:block">
              Pitanja
            </a>
            <a href="#pilot" className="hidden rounded-full px-3 py-2 text-sm font-medium text-lacquer hover:text-lacquer-deep md:block">
              Pilot program
            </a>
            <ButtonLink href="/prijava" variant="ghost" size="sm">
              Prijava
            </ButtonLink>
            <ButtonLink href="/registracija" size="sm">
              Otvori salon
            </ButtonLink>
          </nav>
        </div>
      </header>

      <main>
        {/* Uvod */}
        <section className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-12 pb-24 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-20">
          <div data-reveal="up">
            <p className="inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1 text-sm text-ink-soft ring-1 ring-line">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Za frizerske i kozmetičke salone u BiH
            </p>
            <h1 className="mt-5 font-display text-[2.75rem] leading-[1.02] tracking-[-0.015em] sm:text-6xl lg:text-[4.25rem]">
              Ruke su vam
              <br />u tuđoj kosi.
              <br />
              <span className="text-lacquer">Termine vodi {APP_NAME}.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              Kalendar za cijeli salon, online zakazivanje preko linka i AI recepcioner koji klijentima odgovara na poruke — tačno,
              po vašem cjenovniku i stvarnim slobodnim terminima.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/registracija" size="lg">
                Otvori salon besplatno
              </ButtonLink>
              <ButtonLink href="/s/studio-lana" size="lg" variant="secondary">
                Probaj kao klijent
              </ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              {["Bez instalacije", "Postavljanje za 15 minuta", "AI piše bosanski, hrvatski i srpski"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={15} className="text-mint" strokeWidth={2.5} /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal="scale" className="reveal-delay-1">
            <HeroScene />
          </div>
        </section>

        {/* Problem */}
        <section className="border-y border-line bg-paper/60">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 data-reveal="up" className="max-w-2xl font-display text-3xl leading-tight sm:text-4xl">Zvuči poznato?</h2>
            <div className="reveal-stagger mt-10 grid gap-8 md:grid-cols-3">
              {PAINS.map(({ icon: Icon, title, text }) => (
                <div key={title} data-reveal="up">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lacquer-wash text-lacquer">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-1.5 leading-relaxed text-ink-soft">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mogućnosti */}
        <section id="mogucnosti" className="mx-auto max-w-6xl scroll-mt-20 space-y-28 px-4 py-24 sm:px-6">
          <Feature
            eyebrow="Kalendar i smjene"
            title="Cijeli salon na jednom ekranu"
            text="Svaki radnik u svojoj boji, s radnim vremenom, pauzama i godišnjim. Smjene koje se izmjenjuju svake dvije sedmice, praznici i slobodni dani — a kad se raspored promijeni, odmah vidite koje termine treba prebaciti."
            points={[
              "Prevucite termin na drugo vrijeme ili drugog radnika",
              "Prijedlog ko je slobodan kad neko izostane",
              "Dan, sedmica ili lista — i na telefonu",
            ]}
            visual={<ShiftsVisual />}
          />
          <Feature
            reverse
            eyebrow="Online zakazivanje"
            title="Link za Instagram bio koji radi umjesto vas"
            text="Klijent bira uslugu, radnika i slobodan termin za manje od minute. Vidi samo vrijeme koje stvarno postoji — s trajanjem usluge i pauzom za čišćenje uračunatim."
            points={[
              "Cijene „od“ za usluge koje zavise od kose",
              "Usluge koje traže dogovor ostaju samo na telefonu",
              "Vi određujete koliko unaprijed se može zakazati",
            ]}
            visual={<BookingVisual />}
          />
        </section>

        {/* AI recepcioner */}
        <section id="recepcioner" className="scroll-mt-20 bg-ink text-porcelain">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
            <div data-reveal="up">
              <p className="text-sm font-medium text-porcelain/60">AI recepcioner</p>
              <h2 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Odgovara kao vaša najbolja recepcionerka. I u ponoć.</h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-porcelain/70">
                Zna cjenovnik, radno vrijeme i ko šta radi. Prije nego ponudi termin, provjeri raspored — pa upiše rezervaciju u kalendar. Piše
                jezikom klijenta, kratko i ljubazno.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  "Nikad ne izmišlja slobodne termine — pita sistem",
                  "Kad ne zna, prebaci razgovor vama",
                  "Svaki razgovor i svaki korak vidite u dashboardu",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="text-porcelain/85">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal="scale" className="reveal-delay-1 text-ink">
              <AgentVisual />
            </div>
          </div>
        </section>

        {/* Kanali */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div data-reveal="up">
              <h2 className="font-display text-4xl leading-tight">Jedan recepcioner, svi kanali</h2>
              <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
                Klijenti pišu gdje im je zgodno. Isti recepcioner, s istim pravilima, odgovara na svakom kanalu — a sve završava u jednom
                kalendaru.
              </p>
            </div>
            <ul data-reveal="scale" className="reveal-delay-1 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-paper ring-1 ring-line">
              {CHANNELS.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="flex items-center gap-3 font-medium">
                    {c.name.startsWith("Telefonski") ? (
                      <Phone size={17} className="text-ink-soft" />
                    ) : (
                      <MessageCircle size={17} className="text-ink-soft" />
                    )}
                    {c.name}
                  </span>
                  <span
                    className={
                      c.status === "Radi"
                        ? "rounded-full bg-mint-wash px-2.5 py-0.5 text-xs font-semibold text-mint"
                        : "rounded-full bg-porcelain px-2.5 py-0.5 text-xs font-medium text-ink-soft ring-1 ring-line"
                    }
                  >
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Koraci */}
        <section className="border-y border-line bg-paper/60">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <h2 data-reveal="up" className="max-w-2xl font-display text-4xl leading-tight">Postavljanje traje koliko i jedno feniranje.</h2>
            <ol className="reveal-stagger mt-12 grid gap-10 md:grid-cols-3">
              {[
                ["Unesite usluge", "Naziv, trajanje i cijenu. „Od 60 KM“ za usluge gdje cijena zavisi od kose."],
                ["Dodajte radnike", "Ko radi kada i koje usluge. Podijeljene smjene, pauze i smjene na dvije sedmice."],
                ["Podijelite link", "Stavite ga u Instagram bio i na Google profil — i uključite recepcionera."],
              ].map(([title, text], i) => (
                <li key={title} data-reveal="up" className="border-t-2 border-ink pt-5">
                  <span className="tabular font-display text-2xl text-lacquer">{i + 1}.</span>
                  <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                  <p className="mt-1.5 leading-relaxed text-ink-soft">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pilot */}
        <section id="pilot" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <div data-reveal="scale" className="grid gap-10 rounded-[1.75rem] bg-paper p-6 ring-1 ring-line sm:p-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="text-sm font-medium text-lacquer">Pilot program</p>
              <h2 className="mt-2 font-display text-4xl leading-tight">Prvi saloni koriste {APP_NAME} besplatno</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">
                Tražimo salone koji žele manje telefoniranja i dopisivanja. Mi postavimo sve umjesto vas, a vaše iskustvo oblikuje šta gradimo
                sljedeće.
              </p>
              <ul className="mt-6 space-y-3">
                {["Kalendar, smjene i online zakazivanje", "AI recepcioner u web chatu", "Postavljanje usluga i radnika umjesto vas", "Bez ugovora i kartice"].map(
                  (t) => (
                    <li key={t} className="flex items-center gap-3">
                      <Check size={17} className="shrink-0 text-mint" strokeWidth={2.5} />
                      {t}
                    </li>
                  ),
                )}
              </ul>
            </div>
            <PilotForm />
          </div>
        </section>

        {/* Pitanja */}
        <section id="pitanja" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-24 sm:px-6">
          <h2 data-reveal="up" className="font-display text-4xl leading-tight">Česta pitanja</h2>
          <div data-reveal="up" className="reveal-delay-1 mt-8 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                  {f.q}
                  <ChevronDown size={18} className="shrink-0 text-ink-soft transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Završni poziv */}
        <section className="bg-ink text-porcelain">
          <div data-reveal="up" className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Manje telefoniranja. Više vremena za klijenta u stolici.</h2>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/registracija" size="lg">
                Otvori salon besplatno
              </ButtonLink>
              <Link
                href="/s/studio-lana"
                className="inline-flex h-12 items-center rounded-full px-6 text-porcelain/80 ring-1 ring-white/25 hover:text-white hover:ring-white/50"
              >
                Pogledaj primjer
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-soft sm:px-6">
        <BrandMark />
        <span>Napravljeno u Bosni i Hercegovini</span>
      </footer>
    </div>
  );
}

function Feature({
  eyebrow,
  title,
  text,
  points,
  visual,
  reverse,
}: {
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <div data-reveal={reverse ? "right" : "left"} className={reverse ? "lg:order-2" : ""}>
        <p className="text-sm font-medium text-lacquer">{eyebrow}</p>
        <h2 className="mt-2 font-display text-4xl leading-tight">{title}</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">{text}</p>
        <ul className="mt-6 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <Check size={17} className="mt-0.5 shrink-0 text-mint" strokeWidth={2.5} />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div data-reveal="scale" className={`${reverse ? "lg:order-1" : ""} reveal-delay-1`}>{visual}</div>
    </div>
  );
}
