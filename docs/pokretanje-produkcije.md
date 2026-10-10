# Pokretanje produkcije: domena, baza, mailovi

Redom, od početka do kraja. Lozinke i ključeve upisuješ samo u Vercel, Supabase i
Resend, nikad u chat ni u kod.

## 1. Nova baza za produkciju (Supabase)

Sadašnja baza ostaje za razvoj i testove. Pravi saloni dobijaju svoju.

1. supabase.com → **New project**
   - Name: `rokovnik-prod`
   - Region: **West EU (Ireland)**, ista kao Vercel funkcije (`dub1`)
   - Database password: generiši jaku lozinku i sačuvaj je u password manageru
2. Plan: za pilot je dovoljan **besplatni**. Backup radi naš noćni posao (korak 8). Na **Pro**
   (25 $ mjesečno) prelazimo kad bude 3–5 aktivnih salona ili kad počne naplata; prelazak je jedan klik
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

## 8. Noćni backup baze

Besplatni Supabase nema backup, pa svaku noć GitHub napravi šifrovanu kopiju i čuva je 30 dana.

1. Smisli dugu lozinku za šifrovanje (npr. 5–6 nasumičnih riječi) i **sačuvaj je u password manageru**.
   Bez nje se kopija ne može otvoriti, ni ti ni bilo ko drugi.
2. GitHub → repozitorij → **Settings → Secrets and variables → Actions → New repository secret**:
   - `PROD_DATABASE_URL`: ista adresa kao `DATABASE_URL` na Vercelu (iz koraka 1.3)
   - `BACKUP_PASSPHRASE`: lozinka iz tačke 1
3. **Actions → Backup baze → Run workflow** (akcija `backup`): za minut-dva treba biti zeleno, a dolje
   pod *Artifacts* stoji `rokovnik-<datum>`. Od tada radi svaku noć sam; ako ikad padne, GitHub ti šalje mail.

### Vraćanje iz kopije (ako ikad zatreba)

1. Napravi **novi, prazan** Supabase projekat i kopiraj njegovu Session pooler adresu
2. Dodaj tajnu `RESTORE_DATABASE_URL` s tom adresom
3. **Actions → Backup baze** → otvori noćni posao od dana koji vraćaš i iz adrese kopiraj broj posla
   (`…/actions/runs/`**`1234567890`**)
4. **Run workflow** → akcija `vrati`, `run_id` = taj broj
5. Kad je zeleno, na Vercelu postavi `DATABASE_URL` i `DIRECT_URL` na novu bazu i uradi Redeploy

Isti postupak se automatski isproba na svaku izmjenu backupa, pa znamo da radi.

## 9. Google (Search Console)

Da Google brže pronađe sajt i stranice salona:

1. search.google.com/search-console → **Add property** → **Domain** → `mojrokovnik.com`
2. Google pokaže TXT zapis → upiši ga u DNS kod registra domene → **Verify**
3. **Sitemaps** → upiši `sitemap.xml` → **Submit**
4. Za par dana se vide pretrage po kojima ljudi dolaze i eventualne greške na stranicama
