import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { migrar } from "@/nucleo/bd";

describe("migrar", () => {
  it("aplica cada migración una sola vez", () => {
    const bd = new Database(":memory:");
    const migraciones = [{ id: "prueba-001", sql: "CREATE TABLE t (x INTEGER)" }];
    migrar(bd, migraciones);
    migrar(bd, migraciones);
    expect(bd.prepare("SELECT id FROM migraciones").pluck().all()).toEqual(["prueba-001"]);
  });

  it("no deja nada a medias si una migración falla", () => {
    const bd = new Database(":memory:");
    expect(() => migrar(bd, [{ id: "rota-001", sql: "CREATE TABLE t (x); NO ES SQL" }])).toThrow();
    expect(bd.prepare("SELECT count(*) FROM migraciones").pluck().get()).toBe(0);
    expect(bd.prepare("SELECT count(*) FROM sqlite_master WHERE name = 't'").pluck().get()).toBe(0);
  });
});

describe("GET /api/health", () => {
  it("da 200 y ok si la base de datos responde", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
