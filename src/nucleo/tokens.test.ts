import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { abrir } from "@/nucleo/bd";
import { autenticar } from "@/nucleo/tokens";

const dir = mkdtempSync(join(tmpdir(), "paneles-tokens-"));
const ruta = join(dir, "paneles.db");
abrir(ruta).close();

function tokens(...args: string[]): { status: number | null; stdout: string } {
  const r = spawnSync(process.execPath, [resolve("scripts/tokens.mjs"), ...args], {
    env: { PATH: process.env.PATH, PANELES_DB: ruta },
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout };
}

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("scripts/tokens.mjs", () => {
  it("crea un token que la API acepta, lista sin él y lo revoca", () => {
    const creado = tokens("crear", "--agente", "investigador", "--paneles", "compras");
    expect(creado.status).toBe(0);
    const token = creado.stdout.trim();
    expect(token).toMatch(/^pnl_[A-Za-z0-9_-]{43}$/);

    const bd = abrir(ruta);
    expect(autenticar(bd, `Bearer ${token}`)).toEqual({ agente: "investigador", paneles: ["compras"] });
    expect(bd.prepare("SELECT hash FROM tokens").pluck().get()).not.toContain(token);

    const lista = tokens("listar");
    expect(lista.stdout).toContain("investigador");
    expect(lista.stdout).not.toContain(token);

    expect(tokens("revocar", "--agente", "investigador").stdout).toBe("revocados: 1\n");
    expect(autenticar(bd, `Bearer ${token}`)).toBeNull();
    bd.close();
  });

  it("rechaza un agente o un panel con otros caracteres", () => {
    expect(tokens("crear", "--agente", "Investigador;", "--paneles", "compras").status).toBe(1);
    expect(tokens("crear", "--agente", "investigador", "--paneles", "").status).toBe(1);
    expect(tokens("borrar").status).toBe(1);
  });
});

describe("autenticar", () => {
  it("no acepta una cabecera sin Bearer ni un token con otros caracteres", () => {
    const bd = abrir(ruta);
    expect(autenticar(bd, null)).toBeNull();
    expect(autenticar(bd, "Basic dXNlcjpwYXNz")).toBeNull();
    expect(autenticar(bd, "Bearer ' OR 1=1 --")).toBeNull();
    bd.close();
  });
});
