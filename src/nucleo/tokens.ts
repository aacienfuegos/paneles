import { createHash } from "node:crypto";
import { z } from "zod";
import type { Bd } from "@/nucleo/bd";

export interface Quien {
  readonly agente: string;
  readonly paneles: readonly string[];
}

// Mismo formato que genera scripts/tokens.mjs.
const BEARER = /^Bearer ([A-Za-z0-9_-]{20,200})$/;
const Paneles = z.array(z.string());

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function autenticar(bd: Bd, cabecera: string | null): Quien | null {
  const token = cabecera?.match(BEARER)?.[1];
  if (token === undefined) return null;
  const fila = bd
    .prepare<[string], { agente: string; paneles: string }>(
      "SELECT agente, paneles FROM tokens WHERE hash = ? AND revocado IS NULL",
    )
    .get(hashToken(token));
  if (fila === undefined) return null;
  return { agente: fila.agente, paneles: Paneles.parse(JSON.parse(fila.paneles)) };
}
