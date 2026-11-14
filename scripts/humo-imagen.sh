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

for _ in $(seq 1 12); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$nombre")" = healthy ] && break
  sleep 5
done
test "$(docker inspect -f '{{.State.Health.Status}}' "$nombre")" = healthy

echo "prueba de humo: bien"
