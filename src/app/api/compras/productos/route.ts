import { bd } from "@/nucleo/bd";
import { ErrorApi, leerJson, protegida, validar } from "@/nucleo/api";
import { crearProducto, listarProductos } from "@/modulos/compras/datos";
import { AltaProducto } from "@/modulos/compras/esquema";

export const dynamic = "force-dynamic";

export const GET = protegida("compras", () => Response.json(listarProductos(bd())));

export const POST = protegida("compras", async (req, autor) => {
  const producto = validar(AltaProducto, await leerJson(req));
  if (!crearProducto(bd(), producto, autor)) throw new ErrorApi(409, "existe", `ya hay un producto ${producto.id}`);
  return Response.json(producto, { status: 201 });
});
