#!/usr/bin/env bash
# Prueba de humo de la imagen, arrancada como la despliega el 102: solo lectura salvo /datos y /tmp,
# sin capacidades, con los límites del compose y el usuario que trae la imagen.
set -euo pipefail

imagen=$1
nombre=paneles-humo
url=http://127.0.0.1:3000

fin() {
  docker logs "$nombre" 2>&1 | tail -n 50 || true
  docker rm -f "$nombre" >/dev/null 2>&1 || true
  docker volume rm paneles-humo-datos >/dev/null 2>&1 || true
}
trap fin EXIT

docker run -d --name "$nombre" \
  --read-only --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 256m --pids-limit 128 \
  -e NODE_ENV=production \
  -v paneles-humo-datos:/datos \
  -p 127.0.0.1:3000:3000 \
  "$imagen" >/dev/null

for _ in $(seq 1 30); do
  curl -fsS "$url/api/health" >/dev/null 2>&1 && break
  sleep 1
done

test "$(curl -fsS "$url/api/health")" = '{"ok":true}'
test "$(docker exec "$nombre" id -u):$(docker exec "$nombre" id -g)" = "1001:1001"
docker exec "$nombre" test -s /datos/paneles.db
test "$(curl -s -o /dev/null -w '%{http_code}' "$url/")" = 200

# La API con un token creado como lo hará Andrés en el 102, y la página que lo pinta.
token=$(docker exec "$nombre" node scripts/tokens.mjs crear --agente humo --paneles compras)
test "$(curl -s -o /dev/null -w '%{http_code}' "$url/api/compras/productos")" = 401
test "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $token" "$url/api/compras/productos")" = 200
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' --data-binary @- "$url/api/compras/productos" <<'JSON'
{"id": "humo-producto", "nombre": "Producto de humo", "precioObjetivo": 140, "hasta": "2026-12-01",
 "tiendas": ["amazon.es"], "frecuencia": "semanal", "issueOrigen": "CIE-887",
 "tarjetaAprobacion": "f65b67b1-2c3d-4e5f-8a9b-0c1d2e3f4a5b"}
JSON
)" = 201
pagina=$(curl -fsS -D /tmp/humo-cabeceras "$url/compras")
grep -q 'Producto de humo' <<<"$pagina"
grep -qi "^content-security-policy: default-src 'self'; script-src 'self' 'nonce-" /tmp/humo-cabeceras
grep -qi '^x-content-type-options: nosniff' /tmp/humo-cabeceras
grep -qi '^referrer-policy: no-referrer' /tmp/humo-cabeceras
# Que Next.js aplica el nonce: todos los <script> de la página lo llevan.
test "$(grep -o '<script' <<<"$pagina" | wc -l)" = "$(grep -oE '<script[^>]* nonce="[^"]+"' <<<"$pagina" | wc -l)"

for _ in $(seq 1 12); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$nombre")" = healthy ] && break
  sleep 5
done
test "$(docker inspect -f '{{.State.Health.Status}}' "$nombre")" = healthy

echo "prueba de humo: bien"
