# Rokovnik

Sistem za zakazivanje termina za frizerske i kozmetičke salone, uz AI recepcionera
(poruke, a kasnije i telefonski pozivi). "Rokovnik" je radni naziv — mijenja se u `src/lib/brand.ts`.

## Pokretanje (lokalno, Windows/macOS/Linux)

Potrebno: Node.js 22+. Docker nije potreban — baza je pravi PostgreSQL iz npm paketa.

```bash
npm install
cp .env.example .env          # pa upisati BETTER_AUTH_SECRET
npm run db:start              # terminal 1: baza (ostaviti upaljeno)
npm run db:migrate            # terminal 2: tabele
npm run db:seed               # demo salon "Studio Lana"
npm run dev                   # http://localhost:3100
```

Demo nalog (samo lokalno): `demo@rokovnik.test` / `demo12345` · javna stranica: `/s/studio-lana`

| Komanda | Šta radi |
| --- | --- |
| `npm test` | brzi testovi (računanje termina, vremenske zone) |
| `npm run test:db` | integracioni testovi nad bazom (dupli termini, istovremene rezervacije) |
| `npm run db:generate` | nova migracija nakon izmjene sheme |
| `npm run db:studio` | pregled baze u pregledniku |
| `npm run typecheck` | TypeScript provjera |

## Arhitektura

```
src/
  server/
    db/schema/      Drizzle shema (auth + domen). Svaka tabela ima salon_id.
    domain/         Čista logika bez baze: računanje slobodnih termina, vremenske zone.
    services/       Poslovna pravila: booking, staff, catalog, clients, salons.
    context.ts      Ko je prijavljen i koji salon je aktivan.
    action.ts       Omotač za server akcije (greške → poruke za korisnika).
  app/
    (auth)/         Prijava, registracija, novi salon
    app/            Dashboard: kalendar, usluge, radnici, postavke
    s/[slug]/       Javna stranica salona za online zakazivanje
    api/            Slobodni termini i pretraga klijenata (JSON)
  components/       UI komponente (dugmad, polja, panel, uzorak boje)
  lib/              Formatiranje, telefoni, slug, paleta boja radnika
```

### Pravila kojih se držimo

1. **AI nikad ne računa slobodne termine.** Računa ih `domain/availability.ts`, a AI agent
   (faza 2) samo poziva iste servisne funkcije kao dashboard i javna stranica:
   `getAvailability`, `createAppointment`, `setAppointmentStatus`.
2. **Baza je posljednja odbrana od duplih termina.** `appointment_items` ima exclusion
   constraint (migracija `0001`) — preklapanje kod istog radnika je nemoguće, čak i kad
   recepcija i AI zakazuju u istoj milisekundi.
3. **Vrijeme:** u bazi su UTC trenuci, radno vrijeme je u lokalnim minutama, a konverzija
   (uključujući ljetno/zimsko vrijeme) dešava se samo u `domain/time.ts`.
4. **Multi-tenant:** servisi uvijek primaju `salonId` i filtriraju po njemu. Servisi ne znaju
   za HTTP sesiju, pa ih mogu zvati i webhookovi (Instagram, WhatsApp, Viber) i voice agent.
5. **Klijent = broj telefona** (E.164, `+387…`). Isti broj sa weba, Instagrama ili poziva je
   isti klijent.
6. **Posjeta sa više usluga** (npr. šišanje + feniranje) je jedan `appointment` sa više
   `appointment_items`; cijena i naziv usluge se snimaju u trenutku rezervacije.
7. **Uloge:** `owner` / `manager` mijenjaju cjenovnik i radnike, `staff` vidi i upisuje termine.

## AI recepcioner

`src/server/agent/` — jedan modul za sve kanale:

- `receptionist.ts` — petlja: poruka klijenta → OpenAI (Responses API) → alati → odgovor
- `tools.ts` — alati: slobodni termini, rezervacija, termini klijenta, otkazivanje, prebacivanje osoblju
- `prompt.ts` — uputstva + činjenice o salonu (usluge, radnici, kalendar narednih 15 dana)
- `conversations.ts` — razgovori i poruke (vidljivo u dashboardu → Razgovori, s detaljima svakog alata)

Podešavanje u `.env`: `OPENAI_API_KEY`, `OPENAI_MODEL` (zadano `gpt-5.4-mini`),
`OPENAI_REASONING_EFFORT` (`low` zadano; `none` za modele bez razmišljanja).
Web chat se pojavljuje na `/s/[slug]` samo kad je ključ postavljen.

## Supabase

1. Novi projekat na supabase.com (region: Frankfurt, `eu-central-1`).
2. Project Settings → Database → Connection string:
   `DATABASE_URL` i `DIRECT_URL` = **Session pooler** (port 5432).
   Ne koristiti Transaction pooler (6543): dijeli transakcije na više konekcija i gubi upise.
   Aplikacija odbija da se pokrene s njim.
3. `npm run db:migrate` (i po želji `npm run db:seed`).

Migracija `0003` uključuje RLS na svim tabelama bez politika, tako da Supabase REST API
(javni anon ključ) ne vidi podatke; aplikacija se spaja direktno i radi normalno.
**Nova tabela → u istoj migraciji dodati `ALTER TABLE … ENABLE ROW LEVEL SECURITY`.**

## Plan

- [x] **Faza 1** — nalozi i saloni, radnici (smjene, pauze, odsustva), usluge, kalendar,
      ručni upis, javna stranica za zakazivanje, zaštita od duplih termina
- [x] **Faza 2a** — AI recepcioner u web chatu (OpenAI, alati nad servisima), pregled razgovora
- [ ] **Faza 2b** — podsjetnici (SMS/Viber), odgovor osoblja iz dashboarda
- [ ] **Faza 3** — Instagram/Messenger, WhatsApp, Viber
- [ ] **Faza 4** — glasovni agent (OpenAI Realtime + SIP/preusmjeravanje poziva)
- [ ] **Faza 5** — pretplate, statistika, prilagođeni domeni

## Produkcija (kasnije)

Bilo koji PostgreSQL 14+ (Supabase, Neon, vlastiti server) — samo `DATABASE_URL`.
Aplikacija je standardni Next.js (Vercel ili vlastiti Node server).
