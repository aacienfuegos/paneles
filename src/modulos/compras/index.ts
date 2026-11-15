import type { Modulo } from "@/modulos";
import { MIGRACIONES } from "@/modulos/compras/datos";

export const compras: Modulo = { id: "compras", titulo: "Compras", migraciones: MIGRACIONES };
