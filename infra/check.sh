#!/bin/sh
# Smoke check for infra/docker-compose.yml: database answers, queue persists jobs, bucket is private.
set -eu
cd "$(dirname "$0")"

fail() {
  echo "FALLA: $1" >&2
  exit 1
}

[ -f .env ] || fail "no existe infra/.env (copialo de infra/.env.example)"
set -a
. ./.env
set +a

echo "1. PostgreSQL responde consultas"
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select 1"' | grep -q '^1$' \
  || fail "PostgreSQL no respondió a 'select 1'"

echo "2. Redis guarda en disco y maneja streams"
docker compose exec -T redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning config get appendonly' | grep -q '^yes$' \
  || fail "Redis no tiene appendonly activado: un reinicio perdería la cola"
docker compose exec -T redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning xadd check:stream "*" probe ok >/dev/null && redis-cli -a "$REDIS_PASSWORD" --no-auth-warning del check:stream >/dev/null' \
  || fail "Redis no aceptó XADD en el stream de prueba check:stream"

echo "3. El bucket de comprobantes rechaza pedidos sin credenciales"
# wget exits 8 when the server answers with an HTTP error; the status line must be 403.
anonymous_status=$(docker compose exec -T storage sh -c 'wget -S -q -O /dev/null "http://127.0.0.1:8333/$0" 2>&1 | head -1' "$S3_BUCKET" || true)
echo "$anonymous_status" | grep -q ' 403' \
  || fail "el bucket respondió '$anonymous_status' a un pedido anónimo (se esperaba 403)"

echo "OK: los tres servicios están listos."
