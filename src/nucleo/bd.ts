import Database from "better-sqlite3";
import { MODULOS } from "@/modulos";

export type Bd = Database.Database;

export interface Migracion {
  readonly id: string;
  readonly sql: string;
}

// La instrumentación y las rutas se empaquetan por separado: sin la caché global cada una abriría su conexión.
const cache = globalThis as typeof globalThis & { panelesBd?: Bd };

export function migrar(bd: Bd, migraciones: readonly Migracion[]): void {
  bd.exec("CREATE TABLE IF NOT EXISTS migraciones (id TEXT PRIMARY KEY, aplicada TEXT NOT NULL)");
  const hechas = new Set(bd.prepare("SELECT id FROM migraciones").pluck().all());
  const aplicar = bd.transaction((m: Migracion) => {
    bd.exec(m.sql);
    bd.prepare("INSERT INTO migraciones (id, aplicada) VALUES (?, ?)").run(m.id, new Date().toISOString());
  });
  for (const m of migraciones) {
    if (!hechas.has(m.id)) aplicar(m);
  }
}

export function abrir(ruta: string): Bd {
  const bd = new Database(ruta);
  bd.pragma("journal_mode = WAL");
  bd.pragma("foreign_keys = ON");
  bd.pragma("busy_timeout = 5000");
  migrar(bd, MODULOS.flatMap((m) => m.migraciones));
  return bd;
}

export function bd(): Bd {
  cache.panelesBd ??= abrir(process.env.PANELES_DB ?? "/datos/paneles.db");
  return cache.panelesBd;
}
