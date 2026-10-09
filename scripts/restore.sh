#!/usr/bin/env bash
# Vraćanje šifrovane kopije (iz scripts/backup.sh) u PRAZNU bazu, npr. novi Supabase projekat.
#   TARGET_URL=… PASSPHRASE=… scripts/restore.sh rokovnik-2026-10-09.dump.gpg
# Isti postupak se svaki put isproba u CI-ju (.github/workflows/backup.yml → proba).
set -euo pipefail

in="${1:?Navedi šifrovanu kopiju (.dump.gpg)}"
: "${TARGET_URL:?TARGET_URL nije postavljen (baza u koju se vraća)}"
: "${PASSPHRASE:?PASSPHRASE nije postavljen}"
plain="$(basename "${in%.gpg}")"
trap 'rm -f "$plain" restore.list' EXIT

gpg --batch --yes --pinentry-mode loopback --passphrase "$PASSPHRASE" --decrypt --output "$plain" "$in"

pg() { docker run --rm --network host -v "$PWD:/b" postgres:17 "$@"; }

# Ekstenzije nisu u kopiji (samo naše šeme) — zaštita od duplih termina treba btree_gist
pg psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c "create extension if not exists btree_gist"

# Šema public u novoj bazi već postoji — njeno pravljenje se preskače
pg pg_restore --list "/b/$plain" | grep -v " SCHEMA - public " > restore.list
pg pg_restore --exit-on-error --no-owner --no-privileges --use-list /b/restore.list --dbname "$TARGET_URL" "/b/$plain"

echo "Vraćeno. Provjera:"
pg psql "$TARGET_URL" -tAc "select 'saloni: ' || count(*) from salons union all select 'termini: ' || count(*) from appointments"
