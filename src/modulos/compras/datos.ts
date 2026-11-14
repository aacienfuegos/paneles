import type { Autor } from "@/nucleo/api";
import type { Bd, Migracion } from "@/nucleo/bd";
import { type Observacion, Producto } from "@/modulos/compras/esquema";

export const MIGRACIONES: readonly Migracion[] = [
  {
    id: "compras-001",
    sql: `
      CREATE TABLE compras_productos (
        id TEXT PRIMARY KEY,
        datos TEXT NOT NULL,
        agente TEXT NOT NULL,
        run TEXT,
        creado TEXT NOT NULL,
        actualizado TEXT NOT NULL
      );
      CREATE TABLE compras_historial (
        id INTEGER PRIMARY KEY,
        producto TEXT NOT NULL REFERENCES compras_productos (id),
        hora TEXT NOT NULL,
        agente TEXT NOT NULL,
        run TEXT,
        anterior TEXT NOT NULL
      );
      CREATE TABLE compras_precios (
        id INTEGER PRIMARY KEY,
        producto TEXT NOT NULL REFERENCES compras_productos (id),
        fecha TEXT NOT NULL,
        instante INTEGER NOT NULL,
        tienda TEXT NOT NULL,
        precio REAL NOT NULL,
        vendedor TEXT NOT NULL,
        garantia INTEGER,
        enlace TEXT,
        nota TEXT,
        agente TEXT NOT NULL,
        run TEXT,
        creado TEXT NOT NULL
      );
      CREATE INDEX compras_precios_producto ON compras_precios (producto, instante DESC);
    `,
  },
];

export interface ObservacionGuardada {
  readonly id: number;
  readonly producto: string;
  readonly fecha: string;
  readonly instante: number;
  readonly tienda: string;
  readonly precio: number;
  readonly vendedor: string;
  readonly garantiaEspana: boolean | null;
  readonly enlace: string | null;
  readonly nota: string | null;
}

interface FilaPrecio {
  readonly id: number;
  readonly producto: string;
  readonly fecha: string;
  readonly instante: number;
  readonly tienda: string;
  readonly precio: number;
  readonly vendedor: string;
  readonly garantia: number | null;
  readonly enlace: string | null;
  readonly nota: string | null;
}

export function listarProductos(bd: Bd): readonly Producto[] {
  return bd
    .prepare<[], { datos: string }>("SELECT datos FROM compras_productos ORDER BY id")
    .all()
    .map((f) => Producto.parse(JSON.parse(f.datos)));
}

export function obtenerProducto(bd: Bd, id: string): Producto | undefined {
  const fila = bd.prepare<[string], { datos: string }>("SELECT datos FROM compras_productos WHERE id = ?").get(id);
  return fila === undefined ? undefined : Producto.parse(JSON.parse(fila.datos));
}

export function crearProducto(bd: Bd, producto: Producto, autor: Autor): boolean {
  const ahora = new Date().toISOString();
  const r = bd
    .prepare(
      `INSERT INTO compras_productos (id, datos, agente, run, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
    )
    .run(producto.id, JSON.stringify(producto), autor.agente, autor.run, ahora, ahora);
  return r.changes === 1;
}

export function cambiarProducto(bd: Bd, anterior: Producto, nuevo: Producto, autor: Autor): void {
  const ahora = new Date().toISOString();
  bd.transaction(() => {
    bd.prepare("INSERT INTO compras_historial (producto, hora, agente, run, anterior) VALUES (?, ?, ?, ?, ?)").run(
      anterior.id,
      ahora,
      autor.agente,
      autor.run,
      JSON.stringify(anterior),
    );
    bd.prepare("UPDATE compras_productos SET datos = ?, agente = ?, run = ?, actualizado = ? WHERE id = ?").run(
      JSON.stringify(nuevo),
      autor.agente,
      autor.run,
      ahora,
      anterior.id,
    );
  })();
}

export function anadirObservacion(bd: Bd, o: Observacion, autor: Autor): ObservacionGuardada {
  const instante = Date.parse(o.fecha);
  const r = bd
    .prepare(
      `INSERT INTO compras_precios
         (producto, fecha, instante, tienda, precio, vendedor, garantia, enlace, nota, agente, run, creado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      o.producto,
      o.fecha,
      instante,
      o.tienda,
      o.precio,
      o.vendedor,
      o.garantiaEspana === null ? null : Number(o.garantiaEspana),
      o.enlace ?? null,
      o.nota ?? null,
      autor.agente,
      autor.run,
      new Date().toISOString(),
    );
  return {
    id: Number(r.lastInsertRowid),
    producto: o.producto,
    fecha: o.fecha,
    instante,
    tienda: o.tienda,
    precio: o.precio,
    vendedor: o.vendedor,
    garantiaEspana: o.garantiaEspana,
    enlace: o.enlace ?? null,
    nota: o.nota ?? null,
  };
}

// LIMIT -1 es sin límite en SQLite: lo usa la página, porque el mínimo histórico es de todas.
export function listarObservaciones(bd: Bd, producto: string, limite = -1): readonly ObservacionGuardada[] {
  return bd
    .prepare<[string, number], FilaPrecio>(
      `SELECT id, producto, fecha, instante, tienda, precio, vendedor, garantia, enlace, nota
       FROM compras_precios WHERE producto = ? ORDER BY instante DESC, id DESC LIMIT ?`,
    )
    .all(producto, limite)
    .map(({ garantia, ...resto }) => ({ ...resto, garantiaEspana: garantia === null ? null : garantia === 1 }));
}
