import { describe, expect, it } from "vitest";
import {
  AltaProducto,
  CambioProducto,
  enlaceValido,
  fechaEnVentana,
  Observacion,
} from "@/modulos/compras/esquema";
import { observacion, producto } from "@/pruebas/utiles";

const HOSTILES = ["<script>alert(1)</script>", 'Liberty "5"', "Liberty'5", "a; DROP TABLE x", "linea\nnueva", "<b>x</b>"];

describe("AltaProducto", () => {
  it("acepta el ejemplo del contrato y pone estado activo", () => {
    const r = AltaProducto.safeParse(producto());
    expect(r.success).toBe(true);
    expect(r.data?.estado).toBe("activo");
  });

  it.each(HOSTILES)("rechaza el nombre de producto %j", (nombre) => {
    expect(AltaProducto.safeParse(producto({ nombre })).success).toBe(false);
  });

  it.each(HOSTILES)("rechaza el nombre de campaña %j", (nombre) => {
    const campanas = [{ nombre, desde: "2026-11-20", hasta: "2026-12-01" }];
    expect(AltaProducto.safeParse(producto({ campanas })).success).toBe(false);
  });

  it("acepta letras con tilde, paréntesis y signos del contrato", () => {
    expect(AltaProducto.safeParse(producto({ nombre: "Auriculares Sony WH-1000XM6 (negro) + funda ñ" })).success).toBe(
      true,
    );
  });

  it.each([
    ["campo desconocido", { extra: 1 }],
    ["campo desconocido en condiciones", { condiciones: { vendedor: "x", otro: true } }],
    ["estado terminado en el alta", { estado: "terminado" }],
    ["id con mayúsculas", { id: "Soundcore" }],
    ["tienda fuera de la lista", { tiendas: ["amazon.com"] }],
    ["tiendas repetidas", { tiendas: ["amazon.es", "amazon.es"] }],
    ["fecha inexistente", { hasta: "2026-02-30" }],
    ["precio con tres decimales", { precioObjetivo: 1.001 }],
    ["precio cero", { precioObjetivo: 0 }],
    ["precio de 100000", { precioObjetivo: 100_000 }],
    ["precio en texto", { precioObjetivo: "140" }],
    ["issue de otro prefijo", { issueOrigen: "ABC-1" }],
    ["tarjeta que no es UUID", { tarjetaAprobacion: "f65b67b1" }],
    ["campaña al revés", { campanas: [{ nombre: "Rebajas", desde: "2026-12-02", hasta: "2026-12-01" }] }],
    ["once campañas", { campanas: Array.from({ length: 11 }, () => ({ nombre: "X", desde: "2026-11-01", hasta: "2026-11-02" })) }],
    ["vendedor con control", { condiciones: { vendedor: "Amazon\u0007" } }],
  ])("rechaza %s", (_, cambios) => {
    expect(AltaProducto.safeParse(producto(cambios)).success).toBe(false);
  });
});

describe("CambioProducto", () => {
  it("rechaza un campo desconocido y el id", () => {
    expect(CambioProducto.safeParse({ frecuencia: "diaria", extra: 1 }).success).toBe(false);
    expect(CambioProducto.safeParse({ id: "otro-id" }).success).toBe(false);
  });

  it("rechaza un cambio vacío", () => {
    expect(CambioProducto.safeParse({}).success).toBe(false);
  });
});

describe("Observacion", () => {
  it("acepta el ejemplo del contrato", () => {
    expect(Observacion.safeParse(observacion({ fecha: "2026-11-10T06:12:00+01:00" })).success).toBe(true);
  });

  it("acepta HTML en la nota y el vendedor: se guarda como texto", () => {
    expect(Observacion.safeParse(observacion({ nota: "<script>alert(1)</script>", vendedor: "<b>x</b>" })).success).toBe(
      true,
    );
  });

  it.each([
    ["fecha sin zona", { fecha: "2026-11-10T06:12:00" }],
    ["nota de 201 caracteres", { nota: "x".repeat(201) }],
    ["nota con salto de línea", { nota: "a\nb" }],
    ["garantía sin poner", { garantiaEspana: undefined }],
    ["campo desconocido", { html: "<b>" }],
  ])("rechaza %s", (_, cambios) => {
    expect(Observacion.safeParse(observacion(cambios)).success).toBe(false);
  });

  it("acepta garantía null (no consta) y sin enlace", () => {
    expect(Observacion.safeParse(observacion({ garantiaEspana: null, enlace: undefined })).success).toBe(true);
  });
});

describe("enlaceValido", () => {
  it.each([
    "https://www.amazon.es/dp/B0XXXXXXX",
    "https://amazon.es/dp/B0XXXXXXX",
  ])("acepta %s", (enlace) => {
    expect(enlaceValido(enlace, "amazon.es")).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "http://www.amazon.es/dp/B0",
    "https://amazon.es.evil.com/dp/B0",
    "https://evilamazon.es/dp/B0",
    "https://usuario:clave@www.amazon.es/dp/B0",
    "https://usuario@www.amazon.es/dp/B0",
    "https://amazon.es@evil.com/",
    "https://www.amazon.es:8443/dp/B0",
    "https://www.amazon.es./dp/B0",
    `https://www.amazon.es/${"x".repeat(480)}`,
    "no es una url",
  ])("rechaza %s", (enlace) => {
    expect(enlaceValido(enlace, "amazon.es")).toBe(false);
  });

  it("rechaza una tienda fuera de la lista aunque el host coincida", () => {
    expect(enlaceValido("https://evil.com/", "evil.com")).toBe(false);
  });

  it("rechaza el enlace en la observación si no es de su tienda", () => {
    expect(Observacion.safeParse(observacion({ tienda: "fnac.es" })).success).toBe(false);
  });
});

describe("fechaEnVentana", () => {
  const ahora = Date.parse("2026-11-14T12:00:00Z");

  it("acepta hasta 1 hora en el futuro y 30 días en el pasado", () => {
    expect(fechaEnVentana("2026-11-14T13:00:00Z", ahora)).toBe(true);
    expect(fechaEnVentana("2026-10-15T12:00:00Z", ahora)).toBe(true);
  });

  it("rechaza lo que pasa de esos límites", () => {
    expect(fechaEnVentana("2026-11-14T13:00:01Z", ahora)).toBe(false);
    expect(fechaEnVentana("2026-10-15T11:59:59Z", ahora)).toBe(false);
  });
});
