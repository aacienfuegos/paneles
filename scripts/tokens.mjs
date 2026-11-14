// Tokens de escritura de la API. Dentro del contenedor:
//   node scripts/tokens.mjs crear --agente investigador --paneles compras   (imprime el token, solo esta vez)
//   node scripts/tokens.mjs revocar --agente investigador
//   node scripts/tokens.mjs listar
// Solo se guarda el SHA-256 del token, como lo calcula src/nucleo/tokens.ts.
import { createHash, randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import Database from "better-sqlite3";

const NOMBRE = /^[a-z0-9-]{1,40}$/;

function fallar(mensaje) {
  process.stderr.write(`${mensaje}\n`);
  process.exit(1);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { agente: { type: "string" }, paneles: { type: "string" } },
});
const [orden] = positionals;

const bd = new Database(process.env.PANELES_DB ?? "/datos/paneles.db", { fileMustExist: true });
bd.pragma("busy_timeout = 5000");
if (bd.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tokens'").get() === undefined) {
  fallar("no hay tabla tokens: arranca la aplicación una vez para que cree el esquema");
}

function agente() {
  if (values.agente === undefined || !NOMBRE.test(values.agente)) fallar("--agente: minúsculas, números y guiones");
  return values.agente;
}

if (orden === "crear") {
  const quien = agente();
  const paneles = (values.paneles ?? "").split(",");
  if (!paneles.every((p) => NOMBRE.test(p))) fallar("--paneles: lista separada por comas, p. ej. compras");
  const token = `pnl_${randomBytes(32).toString("base64url")}`;
  bd.prepare("INSERT INTO tokens (agente, paneles, hash, creado) VALUES (?, ?, ?, ?)").run(
    quien,
    JSON.stringify(paneles),
    createHash("sha256").update(token).digest("hex"),
    new Date().toISOString(),
  );
  process.stdout.write(`${token}\n`);
} else if (orden === "revocar") {
  const r = bd
    .prepare("UPDATE tokens SET revocado = ? WHERE agente = ? AND revocado IS NULL")
    .run(new Date().toISOString(), agente());
  process.stdout.write(`revocados: ${r.changes}\n`);
} else if (orden === "listar") {
  for (const t of bd.prepare("SELECT id, agente, paneles, creado, revocado FROM tokens ORDER BY id").all()) {
    process.stdout.write(`${t.id}\t${t.agente}\t${t.paneles}\t${t.creado}\t${t.revocado ?? "activo"}\n`);
  }
} else {
  fallar("uso: node scripts/tokens.mjs crear --agente <a> --paneles <p,q> | revocar --agente <a> | listar");
}
