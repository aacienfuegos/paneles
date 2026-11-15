import type { Metadata } from "next";
import { connection } from "next/server";
import { bd } from "@/nucleo/bd";
import { listarProductos } from "@/modulos/compras/datos";
import { Fila } from "@/modulos/compras/vista";

export const metadata: Metadata = { title: "Compras - Paneles" };

export default async function Compras() {
  await connection();
  const ahora = Date.now();
  const productos = listarProductos(bd());
  const activos = productos.filter((p) => p.estado === "activo");
  const terminados = productos.filter((p) => p.estado === "terminado");
  return (
    <main>
      <h1>Compras</h1>
      {activos.length === 0 && <p>No hay ningún producto en vigilancia.</p>}
      {activos.map((p) => (
        <Fila key={p.id} producto={p} ahora={ahora} />
      ))}
      {terminados.length > 0 && (
        <details>
          <summary>{`Terminados (${terminados.length})`}</summary>
          {terminados.map((p) => (
            <Fila key={p.id} producto={p} ahora={ahora} />
          ))}
        </details>
      )}
    </main>
  );
}
