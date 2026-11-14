import type { ObservacionGuardada } from "@/modulos/compras/datos";
import type { Producto } from "@/modulos/compras/esquema";

const OCHO_DIAS = 8 * 24 * 3_600_000;
const DIA_MADRID = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" });

export interface Resumen {
  readonly actual: ObservacionGuardada | undefined;
  readonly minimo: ObservacionGuardada | undefined;
  readonly veredicto: string;
}

export interface PuntoDiario {
  readonly dia: string;
  readonly precio: number;
}

// sv-SE formatea como YYYY-MM-DD, el mismo formato que las fechas del contrato.
export function diaMadrid(instante: number): string {
  return DIA_MADRID.format(instante);
}

// A igual precio gana la observación más reciente.
function masBarata(obs: readonly ObservacionGuardada[]): ObservacionGuardada | undefined {
  return obs.reduce<ObservacionGuardada | undefined>(
    (min, o) =>
      min === undefined || o.precio < min.precio || (o.precio === min.precio && o.instante > min.instante) ? o : min,
    undefined,
  );
}

export function veredicto(producto: Producto, actual: ObservacionGuardada | undefined, hoy: string): string {
  if (actual === undefined) return "Sin dato reciente";
  if (actual.precio <= producto.precioObjetivo) return "Comprar ya";
  const [campana] = producto.campanas
    .filter((c) => c.hasta >= hoy && c.desde < producto.hasta)
    .toSorted((a, b) => a.hasta.localeCompare(b.hasta));
  return campana === undefined
    ? `Esperar: sin campaña prevista antes del ${producto.hasta}`
    : `Esperar hasta ${campana.hasta} por ${campana.nombre}`;
}

export function resumir(producto: Producto, obs: readonly ObservacionGuardada[], ahora: number): Resumen {
  const actual = masBarata(obs.filter((o) => o.instante >= ahora - OCHO_DIAS));
  return { actual, minimo: masBarata(obs), veredicto: veredicto(producto, actual, diaMadrid(ahora)) };
}

export function minimosDiarios(obs: readonly ObservacionGuardada[]): readonly PuntoDiario[] {
  const porDia = new Map<string, number>();
  for (const o of obs) {
    const dia = diaMadrid(o.instante);
    porDia.set(dia, Math.min(o.precio, porDia.get(dia) ?? Infinity));
  }
  return [...porDia]
    .map(([dia, precio]) => ({ dia, precio }))
    .toSorted((a, b) => a.dia.localeCompare(b.dia));
}
