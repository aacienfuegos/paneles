import { bd } from "@/nucleo/bd";
import { ErrorApi, leerJson, protegida, validar } from "@/nucleo/api";
import { cambiarProducto, obtenerProducto } from "@/modulos/compras/datos";
import { CambioProducto, Producto } from "@/modulos/compras/esquema";

export const dynamic = "force-dynamic";

// Ampliar lo que se vigila o reactivarlo pide una tarjeta nueva; retirar algo de la vigilancia, no.
function pideTarjeta(anterior: Producto, cambio: CambioProducto): boolean {
  const amplia = cambio.precioObjetivo !== undefined || cambio.hasta !== undefined || cambio.condiciones !== undefined;
  return amplia || (anterior.estado === "terminado" && cambio.estado === "activo");
}

export const PATCH = protegida<{ id: string }>("compras", async (req, autor, { id }) => {
  const cambio = validar(CambioProducto, await leerJson(req));
  const anterior = obtenerProducto(bd(), id);
  if (anterior === undefined) throw new ErrorApi(404, "no_existe", "no hay ningún producto con ese id");
  const tarjetaNueva = cambio.tarjetaAprobacion !== undefined && cambio.tarjetaAprobacion !== anterior.tarjetaAprobacion;
  if (pideTarjeta(anterior, cambio) && !tarjetaNueva) {
    throw new ErrorApi(400, "tarjeta_requerida", "este cambio necesita un tarjetaAprobacion nuevo");
  }
  const nuevo = validar(Producto, { ...anterior, ...cambio });
  cambiarProducto(bd(), anterior, nuevo, autor);
  return Response.json(nuevo);
});
