#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-backend/.env}"
OUT_FILE="${1:-db_dump.sql}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No se encontro el archivo de entorno: $ENV_FILE" >&2
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  DATABASE_URL=$(rg -m 1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
else
  DATABASE_URL=$(grep -m 1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
fi
if [[ -z "${DATABASE_URL}" ]]; then
  echo "DATABASE_URL no esta definido en $ENV_FILE" >&2
  exit 1
fi

url_no_proto="${DATABASE_URL#mysql://}"
creds_and_host="${url_no_proto%%/*}"
DB_NAME="${url_no_proto#*/}"
USER_PASS="${creds_and_host%@*}"
HOST_PORT="${creds_and_host#*@}"
DB_USER="${USER_PASS%%:*}"
DB_PASS="${USER_PASS#*:}"
DB_HOST="${HOST_PORT%%:*}"
DB_PORT="${HOST_PORT#*:}"

if [[ "$DB_HOST" != "127.0.0.1" && "$DB_HOST" != "localhost" ]]; then
  echo "DATABASE_URL apunta a $DB_HOST. Este script esta pensado para la BD local en Docker." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q '^leblond-mysql$'; then
  echo "El contenedor leblond-mysql no esta en ejecucion. Ejecuta: docker compose up -d" >&2
  exit 1
fi

docker exec -i leblond-mysql \
  mysqldump -u"$DB_USER" -p"$DB_PASS" -P"$DB_PORT" "$DB_NAME" > "$OUT_FILE"

echo "Dump creado: $OUT_FILE"
