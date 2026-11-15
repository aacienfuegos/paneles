import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type Entrada = Record<string, unknown>;
type Lock = { readonly packages: Record<string, Entrada> };

const SCRIPT = resolve(__dirname, "npm-audit.mjs");
const RAIZ = resolve(__dirname, "..");
const LIMPIO = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
};
const HIGH = {
  auditReportVersion: 2,
  vulnerabilities: {
    next: {
      name: "next",
      severity: "high",
      via: [{ name: "next", title: "Prueba", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc", severity: "high" }],
    },
  },
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
};

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function gate(cambiar: (p: Lock["packages"]) => void, opciones: { shrinkwrap?: boolean; informe?: object } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "npm-audit-"));
  dirs.push(dir);
  const lock = JSON.parse(readFileSync(join(RAIZ, "package-lock.json"), "utf8")) as Lock;
  cambiar(lock.packages);
  writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock));
  writeFileSync(join(dir, "package.json"), readFileSync(join(RAIZ, "package.json")));
  if (opciones.shrinkwrap) writeFileSync(join(dir, "npm-shrinkwrap.json"), "{}");
  writeFileSync(join(dir, "informe.json"), JSON.stringify(opciones.informe ?? LIMPIO));
  const run = spawnSync(process.execPath, [SCRIPT, "--report", "informe.json"], { cwd: dir, encoding: "utf8" });
  return { status: run.status, salida: run.stdout + run.stderr };
}

const zod = (p: Lock["packages"]) => p["node_modules/zod"];

describe("scripts/npm-audit.mjs", () => {
  it("deja pasar el package-lock.json del repo", () => {
    expect(gate(() => {})).toMatchObject({ status: 0 });
  });

  it("para una advisory high", () => {
    const r = gate(() => {}, { informe: HIGH });
    expect(r.status).toBe(1);
    expect(r.salida).toContain("GHSA-aaaa-bbbb-cccc");
  });

  it.each<[string, (p: Lock["packages"]) => void, string]>([
    ["version subida con el resolved de antes", (p) => Object.assign(zod(p), { version: "4.9.9" }), "resolved"],
    ["otro registry", (p) => Object.assign(zod(p), { resolved: "https://evil.example/zod/-/zod-4.6.7.tgz" }), "resolved"],
    ["integrity que no es sha512", (p) => Object.assign(zod(p), { integrity: "sha1-abc" }), "integrity"],
    ["alias por name", (p) => Object.assign(zod(p), { name: "zod-malo" }), "name zod-malo"],
    ["link fuera de los workspaces", (p) => Object.assign(zod(p), { link: true, resolved: "../../tmp/x" }), "workspace"],
  ])("para un lockfile con %s", (_, cambiar, motivo) => {
    const r = gate(cambiar);
    expect(r.status).toBe(1);
    expect(r.salida).toContain(motivo);
  });

  it("para si hay npm-shrinkwrap.json", () => {
    const r = gate(() => {}, { shrinkwrap: true });
    expect(r.status).toBe(1);
    expect(r.salida).toContain("npm-shrinkwrap.json");
  });
});
