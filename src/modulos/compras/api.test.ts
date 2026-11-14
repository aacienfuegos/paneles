import { beforeEach, describe, expect, it } from "vitest";
import * as precios from "@/app/api/compras/precios/route";
import * as unProducto from "@/app/api/compras/productos/[id]/route";
import * as productos from "@/app/api/compras/productos/route";
import { MAX_CUERPO } from "@/nucleo/api";
import { bd } from "@/nucleo/bd";
import { limpiar, observacion, params, peticion, producto, RUN, SIN_PARAMS, token } from "@/pruebas/utiles";

const ID = "soundcore-liberty-5-pro";
const OTRA_TARJETA = "0b6f2b4e-7a1c-4d2e-9f3a-5b6c7d8e9f01";
let t = "";

beforeEach(() => {
  limpiar();
  t = token(["compras"]);
});

function alta(cambios: Record<string, unknown> = {}): Promise<Response> {
  return productos.POST(peticion("POST", "/api/compras/productos", { token: t, cuerpo: producto(cambios) }), SIN_PARAMS);
}

function cambiar(cuerpo: unknown): Promise<Response> {
  return unProducto.PATCH(peticion("PATCH", `/api/compras/productos/${ID}`, { token: t, cuerpo }), params({ id: ID }));
}

function observar(cambios: Record<string, unknown> = {}): Promise<Response> {
  return precios.POST(peticion("POST", "/api/compras/precios", { token: t, cuerpo: observacion(cambios) }), SIN_PARAMS);
}

function escrituras(): unknown[] {
  return bd().prepare("SELECT agente, run, metodo, ruta, codigo FROM escrituras ORDER BY id").all();
}

describe("autenticación", () => {
  it("sin token, 401, y no se registra", async () => {
    const r = await productos.POST(peticion("POST", "/api/compras/productos", { cuerpo: producto() }), SIN_PARAMS);
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ error: "no_autenticado" });
    expect(escrituras()).toEqual([]);
  });

  it("con un token que no existe o revocado, 401", async () => {
    const r = await productos.GET(peticion("GET", "/api/compras/productos", { token: "pnl_" + "a".repeat(43) }), SIN_PARAMS);
    expect(r.status).toBe(401);
    bd().prepare("UPDATE tokens SET revocado = ?").run(new Date().toISOString());
    expect((await productos.GET(peticion("GET", "/api/compras/productos", { token: t }), SIN_PARAMS)).status).toBe(401);
  });

  it("con un token de otro panel, 403, y se registra", async () => {
    const otro = token(["viajes"], "otro-agente");
    const r = await productos.POST(peticion("POST", "/api/compras/productos", { token: otro, cuerpo: producto() }), SIN_PARAMS);
    expect(r.status).toBe(403);
    expect(escrituras()).toEqual([
      { agente: "otro-agente", run: RUN, metodo: "POST", ruta: "/api/compras/productos", codigo: 403 },
    ]);
  });

  it("no hay DELETE en ninguna ruta (Next.js responde 405)", () => {
    for (const ruta of [productos, unProducto, precios]) expect(Object.keys(ruta)).not.toContain("DELETE");
  });
});

describe("productos", () => {
  it("da de alta el ejemplo del contrato con 201 y lo registra con el run", async () => {
    const r = await alta();
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ id: ID, nombre: "Soundcore Liberty 5 Pro", estado: "activo" });
    expect(escrituras()).toEqual([
      { agente: "investigador", run: RUN, metodo: "POST", ruta: "/api/compras/productos", codigo: 201 },
    ]);
    const lista = await (await productos.GET(peticion("GET", "/api/compras/productos", { token: t }), SIN_PARAMS)).json();
    expect(lista).toHaveLength(1);
  });

  it("409 si el id ya existe", async () => {
    await alta();
    expect((await alta()).status).toBe(409);
  });

  it.each([
    ["HTML en el nombre", { nombre: "<script>alert(1)</script>" }],
    ["campo desconocido", { extra: true }],
  ])("400 con %s", async (_, cambios) => {
    const r = await alta(cambios);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: "validacion" });
  });

  it("400 si el cuerpo no es JSON", async () => {
    const r = await productos.POST(peticion("POST", "/api/compras/productos", { token: t, cuerpo: "{no" }), SIN_PARAMS);
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: "json_invalido" });
  });

  it("413 con un cuerpo de más de 16 KB", async () => {
    const grande = JSON.stringify(producto({ nombre: "x".repeat(MAX_CUERPO) }));
    const r = await productos.POST(peticion("POST", "/api/compras/productos", { token: t, cuerpo: grande }), SIN_PARAMS);
    expect(r.status).toBe(413);
    expect(await r.json()).toMatchObject({ error: "demasiado_grande" });
  });

  it("cambiar el objetivo pide una tarjeta nueva y guarda la versión anterior", async () => {
    await alta();
    expect((await cambiar({ precioObjetivo: 150 })).status).toBe(400);
    const misma = await cambiar({ precioObjetivo: 150, tarjetaAprobacion: producto().tarjetaAprobacion });
    expect(misma.status).toBe(400);
    expect(await misma.json()).toMatchObject({ error: "tarjeta_requerida" });
    const r = await cambiar({ precioObjetivo: 150, tarjetaAprobacion: OTRA_TARJETA });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ precioObjetivo: 150, tarjetaAprobacion: OTRA_TARJETA });
    const historial = bd()
      .prepare<[], { agente: string; run: string; anterior: string }>("SELECT agente, run, anterior FROM compras_historial")
      .all();
    expect(historial).toHaveLength(1);
    expect(historial[0]).toMatchObject({ agente: "investigador", run: RUN });
    expect(JSON.parse(historial[0].anterior)).toMatchObject({ precioObjetivo: 140 });
  });

  it("hasta y condiciones también piden tarjeta; campañas, frecuencia y tiendas, no", async () => {
    await alta();
    expect((await cambiar({ hasta: "2026-12-31" })).status).toBe(400);
    expect((await cambiar({ condiciones: { segundaMano: true } })).status).toBe(400);
    expect((await cambiar({ campanas: [], frecuencia: "diaria", tiendas: ["amazon.es"] })).status).toBe(200);
  });

  it("pasar a terminado no pide tarjeta; volver a activo, sí", async () => {
    await alta();
    expect((await cambiar({ estado: "terminado" })).status).toBe(200);
    expect((await cambiar({ estado: "activo" })).status).toBe(400);
    expect((await cambiar({ estado: "activo", tarjetaAprobacion: OTRA_TARJETA })).status).toBe(200);
  });

  it("404 si el producto no existe y 400 si se intenta cambiar el id", async () => {
    expect((await cambiar({ frecuencia: "diaria" })).status).toBe(404);
    await alta();
    expect((await cambiar({ id: "otro-id" })).status).toBe(400);
  });
});

describe("precios", () => {
  it("añade una observación con 201 y la lista de la más reciente a la más antigua", async () => {
    await alta();
    expect((await observar({ precio: 150, fecha: new Date(Date.now() - 7_200_000).toISOString() })).status).toBe(201);
    expect((await observar({ precio: 129.99 })).status).toBe(201);
    const r = await precios.GET(peticion("GET", `/api/compras/precios?producto=${ID}`, { token: t }), SIN_PARAMS);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { precio: number }[]).map((o) => o.precio)).toEqual([129.99, 150]);
  });

  it("guarda tal cual el HTML de la nota", async () => {
    await alta();
    const r = await observar({ nota: "<script>alert(1)</script>" });
    expect(await r.json()).toMatchObject({ nota: "<script>alert(1)</script>" });
  });

  it.each([
    ["javascript:", { enlace: "javascript:alert(1)" }],
    ["data:", { enlace: "data:text/html,<script>alert(1)</script>" }],
    ["otro dominio", { enlace: "https://amazon.es.evil.com/dp/B0" }],
    ["usuario y contraseña", { enlace: "https://u:p@www.amazon.es/dp/B0" }],
    ["fecha 2 horas en el futuro", { fecha: new Date(Date.now() + 7_200_000).toISOString() }],
  ])("400 con %s", async (_, cambios) => {
    await alta();
    expect((await observar(cambios)).status).toBe(400);
  });

  it("409 si el producto no existe o está terminado", async () => {
    expect((await observar()).status).toBe(409);
    await alta();
    await cambiar({ estado: "terminado" });
    expect((await observar()).status).toBe(409);
  });

  it("GET sin producto, 400; con uno que no existe, 404", async () => {
    expect((await precios.GET(peticion("GET", "/api/compras/precios", { token: t }), SIN_PARAMS)).status).toBe(400);
    const r = await precios.GET(peticion("GET", "/api/compras/precios?producto=no-existe", { token: t }), SIN_PARAMS);
    expect(r.status).toBe(404);
  });

  it("las lecturas no se registran", async () => {
    await productos.GET(peticion("GET", "/api/compras/productos", { token: t }), SIN_PARAMS);
    expect(escrituras()).toEqual([]);
  });
});
