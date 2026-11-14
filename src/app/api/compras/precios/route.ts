import { bd } from "@/nucleo/bd";
import { ErrorApi, leerJson, protegida, validar } from "@/nucleo/api";
import { anadirObservacion, listarObservaciones, obtenerProducto } from "@/modulos/compras/datos";
import { ConsultaPrecios, fechaEnVentana, Observacion } from "@/modulos/compras/esquema";

export const dynamic = "force-dynamic";

export const GET = protegida("compras", (req) => {
  const { producto: id } = validar(ConsultaPrecios, Object.fromEntries(new URL(req.url).searchParams));
  if (obtenerProducto(bd(), id) === undefined) throw new ErrorApi(404, "no_existe", "no hay ningún producto con ese id");
  return Response.json(listarObservaciones(bd(), id, 500));
});

export const POST = protegida("compras", async (req, autor) => {
  const o = validar(Observacion, await leerJson(req));
  if (!fechaEnVentana(o.fecha, Date.now())) {
    throw new ErrorApi(400, "validacion", "fecha: más de 1 hora en el futuro o más de 30 días en el pasado");
  }
  if (obtenerProducto(bd(), o.producto)?.estado !== "activo") {
    throw new ErrorApi(409, "no_activo", "el producto no existe o está terminado");
  }
  return Response.json(anadirObservacion(bd(), o, autor), { status: 201 });
});
