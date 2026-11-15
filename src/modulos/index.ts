import { compras } from "@/modulos/compras";
import type { Migracion } from "@/nucleo/bd";

export interface Modulo {
  readonly id: string;
  readonly titulo: string;
  readonly migraciones: readonly Migracion[];
}

export const MODULOS: readonly Modulo[] = [compras];
