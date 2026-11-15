import { bd } from "@/nucleo/bd";
import { listarObservaciones, type ObservacionGuardada } from "@/modulos/compras/datos";
import { enlaceValido, type Producto } from "@/modulos/compras/esquema";
import { euros, garantia } from "@/modulos/compras/formato";
import { Grafica } from "@/modulos/compras/grafica";
import { diaMadrid, minimosDiarios, resumir } from "@/modulos/compras/veredicto";

// Todo lo que pinta esta página lo escribió un agente a partir de webs: va como texto y el enlace se vuelve a comprobar.
export function Observado({ o }: { readonly o: ObservacionGuardada }) {
  return (
    <>
      {`${euros(o.precio)} en ${o.tienda}, vende ${o.vendedor}, ${garantia(o.garantiaEspana)}`}
      {o.nota !== null && ` (${o.nota})`}
      {o.enlace !== null && enlaceValido(o.enlace, o.tienda) && (
        <>
          {" "}
          <a href={o.enlace} rel="noopener noreferrer nofollow">
            ver en la tienda
          </a>
        </>
      )}
    </>
  );
}

export function Fila({ producto, ahora }: { readonly producto: Producto; readonly ahora: number }) {
  const obs = listarObservaciones(bd(), producto.id);
  const { actual, minimo, veredicto } = resumir(producto, obs, ahora);
  return (
    <section className="producto">
      <h2>{producto.nombre}</h2>
      <p className="veredicto">{veredicto}</p>
      <dl>
        <dt>Precio actual</dt>
        <dd>{actual === undefined ? "sin observaciones en los últimos 8 días" : <Observado o={actual} />}</dd>
        <dt>Mínimo histórico</dt>
        <dd>{minimo === undefined ? "sin observaciones" : `${euros(minimo.precio)} el ${diaMadrid(minimo.instante)}`}</dd>
        <dt>Objetivo</dt>
        <dd>{`${euros(producto.precioObjetivo)} hasta el ${producto.hasta}`}</dd>
      </dl>
      <Grafica puntos={minimosDiarios(obs)} objetivo={producto.precioObjetivo} />
    </section>
  );
}
