#!/usr/bin/env bash
# Kopija baze: pg_dump (PostgreSQL 17 iz Dockera) → provjera → šifrovanje AES-256.
#   DB_URL=… PASSPHRASE=… scripts/backup.sh <izlaz.dump.gpg>
# Koristi ga noćni backup i proba vraćanja u .github/workflows/backup.yml.
set -euo pipefail

out="${1:?Navedi izlazni fajl, npr. rokovnik-2026-10-09.dump.gpg}"
plain="${out%.gpg}"
: "${DB_URL:?DB_URL nije postavljen}"
: "${PASSPHRASE:?PASSPHRASE nije postavljen}"

# Samo naši podaci (public) i zapis migracija (drizzle); Supabase sistemske šeme ne treba
docker run --rm --network host -e DB_URL postgres:17 \
  sh -c 'pg_dump "$DB_URL" --format=custom --no-owner --no-privileges --schema=public --schema=drizzle' \
  > "$plain"

# Kopija mora biti čitljiva i imati podatke tabela, inače posao pada (GitHub šalje mail)
tables=$(docker run --rm -v "$PWD:/b" postgres:17 pg_restore --list "/b/$plain" | grep -c "TABLE DATA" || true)
echo "Tabela s podacima: $tables, veličina: $(du -h "$plain" | cut -f1)"
[ "$tables" -gt 5 ]

gpg --batch --yes --pinentry-mode loopback --passphrase "$PASSPHRASE" \
  --symmetric --cipher-algo AES256 --output "$out" "$plain"
shred -u "$plain"
echo "Šifrovana kopija: $out"
