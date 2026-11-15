import { describe, expect, it } from "vitest";
import type { ObservacionGuardada } from "@/modulos/compras/datos";
import { Producto } from "@/modulos/compras/esquema";
import { diaMadrid, minimosDiarios, resumir } from "@/modulos/compras/veredicto";
import { producto } from "@/pruebas/utiles";

const AHORA = Date.parse("2026-11-14T12:00:00Z");
const HORA = 3_600_000;

function prod(cambios: Record<string, unknown> = {}): Producto {
  return Producto.parse(producto({ estado: "activo", ...cambios }));
}

function obs(precio: number, horasAtras: number, id = horasAtras): ObservacionGuardada {
  const instante = AHORA - horasAtras * HORA;
  return {
    id,
    producto: "soundcore-liberty-5-pro",
    fecha: new Date(instante).toISOString(),
    instante,
    tienda: "amazon.es",
    precio,
    vendedor: "Amazon",
    garantiaEspana: true,
    enlace: null,
    nota: null,
  };
}

describe("resumir", () => {
  it("sin observación en 8 días: sin dato reciente, aunque haya mínimo histórico", () => {
    const r = resumir(prod(), [obs(100, 8 * 24 + 1)], AHORA);
    expect(r.veredicto).toBe("Sin dato reciente");
    expect(r.actual).toBeUndefined();
    expect(r.minimo?.precio).toBe(100);
  });

  it("precio actual igual al objetivo: comprar ya", () => {
    expect(resumir(prod(), [obs(140, 2), obs(150, 1)], AHORA).veredicto).toBe("Comprar ya");
  });

  it("precio actual por encima, con campaña antes del hasta: esperar a la más próxima", () => {
    const campanas = [
      { nombre: "Navidad", desde: "2026-11-25", hasta: "2026-12-24" },
      { nombre: "Black Friday", desde: "2026-11-20", hasta: "2026-12-01" },
    ];
    const r = resumir(prod({ campanas, hasta: "2026-12-31" }), [obs(160, 1)], AHORA);
    expect(r.veredicto).toBe("Esperar hasta 2026-12-01 por Black Friday");
  });

  it("no cuenta una campaña ya pasada ni una que empieza después del hasta", () => {
    const campanas = [
      { nombre: "Singles Day", desde: "2026-11-10", hasta: "2026-11-11" },
      { nombre: "Rebajas", desde: "2027-01-07", hasta: "2027-02-28" },
    ];
    const r = resumir(prod({ campanas, hasta: "2026-12-31" }), [obs(160, 1)], AHORA);
    expect(r.veredicto).toBe("Esperar: sin campaña prevista antes del 2026-12-31");
  });

  it("el precio actual es el más bajo de los 8 días y el mínimo histórico el de todas", () => {
    const r = resumir(prod(), [obs(150, 1), obs(145, 48), obs(120, 24 * 20)], AHORA);
    expect(r.actual?.precio).toBe(145);
    expect(r.minimo?.precio).toBe(120);
  });

  it("a igual precio, se queda la observación más reciente", () => {
    expect(resumir(prod(), [obs(150, 30, 1), obs(150, 2, 2)], AHORA).actual?.id).toBe(2);
  });
});

describe("minimosDiarios", () => {
  it("agrupa por día de Madrid y se queda con el mínimo de cada uno, en orden", () => {
    // 23:30 UTC del 13 es ya el 14 en Madrid (UTC+1 en noviembre).
    const tarde = { ...obs(130, 0), instante: Date.parse("2026-11-13T23:30:00Z") };
    const puntos = minimosDiarios([obs(150, 1), tarde, obs(170, 24 + 20)]);
    expect(puntos).toEqual([
      { dia: "2026-11-12", precio: 170 },
      { dia: "2026-11-14", precio: 130 },
    ]);
  });

  it("diaMadrid da YYYY-MM-DD", () => {
    expect(diaMadrid(AHORA)).toBe("2026-11-14");
  });
});
