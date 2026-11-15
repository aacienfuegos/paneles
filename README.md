# paneles

Mini páginas de los agentes del homelab. Cada mini página es un módulo: su ruta (`/compras`), su esquema
y su API de escritura. Los agentes escriben por la API con un token; el navegador solo lee.

- Next.js 16 y TypeScript, datos en SQLite (`/datos/paneles.db`). El esquema se crea al arrancar
  (`src/instrumentation.ts`).
- Un módulo nuevo se registra en `src/modulos/index.ts` con sus migraciones; el núcleo (`src/nucleo/`) no
  se toca.
- Imagen: `ghcr.io/aacienfuegos/paneles`, escucha en el 3000, corre como `1001:1001` y solo escribe en
  `/datos` y `/tmp`. Se despliega en el LXC 102 por digest; la CI la publica y no despliega.

## API y tokens

El contrato está en el documento `contrato-api` de CIE-873. Todo `/api/` salvo `/api/health` pide
`Authorization: Bearer <token>`; las escrituras quedan en la tabla `escrituras` con el `X-Paperclip-Run-Id`.

Los tokens se gestionan dentro del contenedor y solo se guarda su SHA-256:

```bash
docker compose exec paneles node scripts/tokens.mjs crear --agente investigador --paneles compras
docker compose exec paneles node scripts/tokens.mjs revocar --agente investigador
docker compose exec paneles node scripts/tokens.mjs listar
```

## CI

Los workflows viven en `ci/workflows/` hasta que se copian a `.github/workflows/`: la App de los agentes
no tiene el permiso `workflows`. Un cambio en un workflow se propone en `ci/workflows/` y lo copia Andrés.

- `Type check, tests y build`: el gate de dependencias, `tsc`, Vitest y `next build`, en cada PR a `main` y
  en cada push a `main`. El gate (`scripts/npm-audit.mjs`, el mismo de TripPlanner) va antes de `npm ci`:
  exige que cada entrada del lockfile salga del registry de npm con el nombre de su clave, `integrity`
  `sha512-` y sin `link` ni `npm-shrinkwrap.json`, y después para con cualquier advisory high o critical
  que no esté en `scripts/audit-exceptions.json` (por GHSA y paquete, con caducidad de 90 días como mucho).
- `Imagen, prueba de humo y Trivy`: construye la imagen y la arranca como en el 102
  (`scripts/humo-imagen.sh`).
- `Publicar en ghcr.io`: solo en push a `main`, sube la imagen que pasó la prueba. Es el único job con
  `packages: write`.
