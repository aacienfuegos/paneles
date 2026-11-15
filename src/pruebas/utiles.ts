import { randomBytes } from "node:crypto";
import { bd } from "@/nucleo/bd";
import { hashToken } from "@/nucleo/tokens";

export const RUN = "8cc65d29-5a0b-450e-a4e5-632f0bf0308d";

export function limpiar(): void {
  bd().exec(
    "DELETE FROM compras_precios; DELETE FROM compras_historial; DELETE FROM compras_productos; DELETE FROM escrituras; DELETE FROM tokens;",
  );
}

export function token(paneles: readonly string[], agente = "investigador"): string {
  const t = `pnl_${randomBytes(32).toString("base64url")}`;
  bd()
    .prepare("INSERT INTO tokens (agente, paneles, hash, creado) VALUES (?, ?, ?, ?)")
    .run(agente, JSON.stringify(paneles), hashToken(t), new Date().toISOString());
  return t;
}

export function peticion(
  metodo: string,
  ruta: string,
  { token: t, cuerpo, cabeceras = {} }: { token?: string; cuerpo?: unknown; cabeceras?: Record<string, string> } = {},
): Request {
  const headers = new Headers(cabeceras);
  if (t !== undefined) headers.set("authorization", `Bearer ${t}`);
  headers.set("x-paperclip-run-id", RUN);
  const body = cuerpo === undefined ? undefined : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
  return new Request(`http://localhost${ruta}`, { method: metodo, headers, body });
}

export function params<P>(p: P): { params: Promise<P> } {
  return { params: Promise.resolve(p) };
}

export const SIN_PARAMS = params({});

export function producto(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "soundcore-liberty-5-pro",
    nombre: "Soundcore Liberty 5 Pro",
    precioObjetivo: 140,
    hasta: "2026-12-01",
    condiciones: { vendedor: "Amazon o tienda oficial", garantiaEspana: true, segundaMano: false },
    tiendas: ["amazon.es", "pccomponentes.com"],
    frecuencia: "semanal",
    campanas: [{ nombre: "Black Friday", desde: "2026-11-20", hasta: "2026-12-01" }],
    issueOrigen: "CIE-871",
    tarjetaAprobacion: "f65b67b1-2c3d-4e5f-8a9b-0c1d2e3f4a5b",
    ...cambios,
  };
}

export function observacion(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    producto: "soundcore-liberty-5-pro",
    fecha: new Date(Date.now() - 3_600_000).toISOString(),
    tienda: "amazon.es",
    precio: 129.99,
    vendedor: "Amazon",
    garantiaEspana: true,
    enlace: "https://www.amazon.es/dp/B0XXXXXXX",
    nota: "Keepa, a ojo",
    ...cambios,
  };
}
