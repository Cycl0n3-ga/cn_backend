#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$ROOT_DIR/test/.tmp"
TMP_DB="$TMP_DIR/migration-check-$$.db"

mkdir -p "$TMP_DIR"
touch "$TMP_DB"

cleanup() {
  rm -f "$TMP_DB" "$TMP_DB-journal" "$TMP_DB-wal" "$TMP_DB-shm"
}
trap cleanup EXIT

export DATABASE_URL="file:$TMP_DB"

npx prisma migrate deploy --schema "$ROOT_DIR/prisma/schema.prisma"
npx prisma migrate status --schema "$ROOT_DIR/prisma/schema.prisma"
