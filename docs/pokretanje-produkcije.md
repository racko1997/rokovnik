# Pokretanje produkcije: domena, baza, mailovi

Redom, od početka do kraja. Lozinke i ključeve upisuješ samo u Vercel, Supabase i
Resend, nikad u chat ni u kod.

## 1. Nova baza za produkciju (Supabase)

Sadašnja baza ostaje za razvoj i testove. Pravi saloni dobijaju svoju.

1. supabase.com → **New project**
   - Name: `rokovnik-prod`
   - Region: **West EU (Ireland)**, ista kao Vercel funkcije (`dub1`)
   - Database password: generiši jaku lozinku i sačuvaj je u password manageru
2. Organizacija → **Billing** → prebaci na **Pro** (dnevni backup podataka)
3. Projekat → **Connect** → kartica **Session pooler** → kopiraj adresu (port **5432**,
   ne 6543), pa u nju upiši lozinku umjesto `[YOUR-PASSWORD]`
4. Project Settings → Database → **Pool size: 40**

## 2. Domena na Vercelu

1. Vercel → projekat → **Settings → Domains → Add** → `tvojadomena.ba`
   - Kad ponudi `www.`, izaberi da **preusmjerava na `tvojadomena.ba`**, jer prijava radi samo na jednoj adresi
2. Kod registra domene upiši DNS zapise koje Vercel pokaže, pa sačekaj zelenu kvačicu

## 3. Mailovi (Resend)

1. resend.com → **Domains → Add domain** → `tvojadomena.ba`, region **eu-west-1**
2. Upiši DNS zapise (MX, SPF, DKIM) kod registra domene i sačekaj **Verified**

## 4. Varijable na Vercelu

Vercel → **Settings → Environment Variables**. Za sve stavi okruženje **Production**:

| Varijabla | Vrijednost |
| --- | --- |
| `DATABASE_URL` | adresa iz koraka 1.3 |
| `DIRECT_URL` | ista adresa |
| `BETTER_AUTH_URL` | `https://tvojadomena.ba` |
| `NEXT_PUBLIC_APP_URL` | `https://tvojadomena.ba` |
| `EMAIL_FROM` | `Rokovnik <noreply@tvojadomena.ba>` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | npr. `kontakt@tvojadomena.ba` (stoji na stranicama privatnosti i uslova) |
| `NEXT_PUBLIC_OPERATOR_NAME` | ko pruža uslugu, npr. `Ime Prezime` ili naziv firme |

`RESEND_API_KEY`, `ADMIN_EMAILS`, `OPENAI_API_KEY` i `BETTER_AUTH_SECRET` ostaju kakvi jesu.

## 5. Objava

1. **Deployments → Redeploy** (posljednji deploy grane `main`)
   - Pri objavi se same naprave sve tabele u novoj bazi (`vercel-build` pokreće migracije)
2. Otvori `https://tvojadomena.ba/registracija` i napravi svoj nalog s emailom iz `ADMIN_EMAILS`
3. Otvori `/admin/prijave` → **Obnovi demo salon**, da „Probaj kao klijent“ radi
4. Vercel → **Analytics** → **Enable** (anonimna statistika posjeta, bez kolačića)

## 6. Provjera (5 minuta)

- [ ] `/zaboravljena-lozinka` → stiže mail s linkom → nova lozinka radi
- [ ] Registracija novog testnog naloga → stiže mail „Potvrdite email“
- [ ] `/s/studio-lana` → zakaži termin sa svojim emailom → stiže potvrda s linkom, a vlasniku demo
      salona ide obavijest (demo nalog ima `.test` adresu, pa taj mail neće stići, i to je u redu)
- [ ] Link iz potvrde → pomjeri, pa otkaži termin
- [ ] Pilot forma na naslovnoj → stiže ti mail o novoj prijavi
- [ ] Podijeli link naslovne u Viberu sam sebi → vidi se kartica sa slikom

## 7. OpenAI limit

platform.openai.com:
- **Settings → Limits** → mjesečni limit potrošnje (npr. 20 $) i upozorenje na 50 %
- Za Rokovnik napravi **poseban API ključ**, odvojen od Codex-a, pa ga stavi u `OPENAI_API_KEY`
  na Vercelu i lokalno u `.env`
