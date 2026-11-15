import { euros } from "@/modulos/compras/formato";
import type { PuntoDiario } from "@/modulos/compras/veredicto";

const ANCHO = 600;
const ALTO = 160;
const MARGEN_X = 8;
const MARGEN_Y = 18;
const DIA = 86_400_000;

function instante(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`);
}

// SVG hecho en el servidor: sin JavaScript, y cada punto lleva su valor en <title>.
export function Grafica({ puntos, objetivo }: { readonly puntos: readonly PuntoDiario[]; readonly objetivo: number }) {
  if (puntos.length === 0) return null;
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const dias = Math.max(1, (instante(ultimo.dia) - instante(primero.dia)) / DIA);
  const valores = [...puntos.map((p) => p.precio), objetivo];
  const bajo = Math.min(...valores);
  const rango = Math.max(...valores) - bajo || 1;
  const x = (dia: string): number =>
    puntos.length === 1
      ? ANCHO / 2
      : MARGEN_X + ((instante(dia) - instante(primero.dia)) / DIA / dias) * (ANCHO - 2 * MARGEN_X);
  const y = (v: number): number => ALTO - MARGEN_Y - ((v - bajo) / rango) * (ALTO - 2 * MARGEN_Y);
  const pie = `Precio mínimo de cada día, del ${primero.dia} al ${ultimo.dia}. Objetivo: ${euros(objetivo)}.`;
  return (
    <figure className="grafica">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={pie}>
        <line className="objetivo" x1={0} x2={ANCHO} y1={y(objetivo)} y2={y(objetivo)} />
        <text className="etiqueta" x={ANCHO - MARGEN_X} y={y(objetivo) - 5} textAnchor="end">
          {`objetivo ${euros(objetivo)}`}
        </text>
        <polyline className="linea" points={puntos.map((p) => `${x(p.dia)},${y(p.precio)}`).join(" ")} />
        {puntos.map((p) => (
          <circle key={p.dia} className="punto" cx={x(p.dia)} cy={y(p.precio)} r={4}>
            <title>{`${p.dia}: ${euros(p.precio)}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption>{pie}</figcaption>
    </figure>
  );
}
