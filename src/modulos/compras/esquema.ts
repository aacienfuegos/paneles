import { z } from "zod";

// Lista cerrada del contrato (CIE-873): cambiarla es un PR.
export const TIENDAS = [
  "amazon.es",
  "pccomponentes.com",
  "mediamarkt.es",
  "elcorteingles.es",
  "fnac.es",
  "worten.es",
  "carrefour.es",
  "es.soundcore.com",
] as const;

const HORA = 3_600_000;
const DIA = 24 * HORA;

function esFechaReal(fecha: string): boolean {
  const t = Date.parse(`${fecha}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(fecha);
}

// 129.99 * 100 no da un entero exacto en coma flotante: se compara con margen.
function dosDecimales(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

const Id = z.string().regex(/^[a-z0-9-]{3,60}$/, "formato de id");
const Fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha YYYY-MM-DD")
  .refine(esFechaReal, "fecha inexistente");
const Precio = z.number().gt(0).lt(100_000).refine(dosDecimales, "dos decimales como mucho");
const Texto = z
  .string()
  .min(1)
  .max(200)
  .regex(/^\P{Cc}*$/u, "caracteres de control");
const Tienda = z.enum(TIENDAS);

const Campana = z
  .strictObject({
    nombre: z.string().regex(/^[\p{L}\p{N} .-]{1,40}$/u, "nombre de campaña"),
    desde: Fecha,
    hasta: Fecha,
  })
  .refine((c) => c.desde <= c.hasta, "desde es posterior a hasta");

const Condiciones = z.strictObject({
  vendedor: Texto.optional(),
  garantiaEspana: z.boolean().optional(),
  segundaMano: z.boolean().optional(),
});

const campos = {
  id: Id,
  nombre: z.string().regex(/^[\p{L}\p{N} .()+-]{1,80}$/u, "nombre de producto"),
  precioObjetivo: Precio,
  hasta: Fecha,
  condiciones: Condiciones,
  tiendas: z
    .array(Tienda)
    .min(1)
    .refine((t) => new Set(t).size === t.length, "tiendas repetidas"),
  frecuencia: z.enum(["semanal", "diaria"]),
  campanas: z.array(Campana).max(10),
  issueOrigen: z.string().max(20).regex(/^CIE-[0-9]+$/, "issue de origen"),
  tarjetaAprobacion: z.uuid(),
  estado: z.enum(["activo", "terminado"]),
};

export const Producto = z.strictObject(campos);
export type Producto = z.infer<typeof Producto>;

export const AltaProducto = z.strictObject({
  ...campos,
  condiciones: Condiciones.default({}),
  campanas: campos.campanas.default([]),
  estado: z.literal("activo").default("activo"),
});

export const CambioProducto = Producto.omit({ id: true })
  .partial()
  .refine((c) => Object.keys(c).length > 0, "sin cambios");
export type CambioProducto = z.infer<typeof CambioProducto>;

export const ConsultaPrecios = z.object({ producto: Id });

export function enlaceValido(enlace: string, tienda: string): boolean {
  if (enlace.length > 500 || !TIENDAS.some((t) => t === tienda) || !URL.canParse(enlace)) return false;
  const url = new URL(enlace);
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    (url.hostname === tienda || url.hostname.endsWith(`.${tienda}`))
  );
}

export const Observacion = z
  .strictObject({
    producto: Id,
    fecha: z.iso.datetime({ offset: true }),
    tienda: Tienda,
    precio: Precio,
    vendedor: Texto,
    garantiaEspana: z.boolean().nullable(),
    enlace: z.string().optional(),
    nota: Texto.optional(),
  })
  .refine((o) => o.enlace === undefined || enlaceValido(o.enlace, o.tienda), {
    message: "enlace: https, sin usuario, sin puerto y en el dominio de la tienda",
    path: ["enlace"],
  });
export type Observacion = z.infer<typeof Observacion>;

export function fechaEnVentana(fecha: string, ahora: number): boolean {
  const t = Date.parse(fecha);
  return t <= ahora + HORA && t >= ahora - 30 * DIA;
}
