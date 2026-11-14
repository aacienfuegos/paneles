import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ObservacionGuardada } from "@/modulos/compras/datos";
import { Grafica } from "@/modulos/compras/grafica";
import { Observado } from "@/modulos/compras/vista";

const BASE: ObservacionGuardada = {
  id: 1,
  producto: "soundcore-liberty-5-pro",
  fecha: "2026-11-10T06:12:00+01:00",
  instante: Date.parse("2026-11-10T06:12:00+01:00"),
  tienda: "amazon.es",
  precio: 129.99,
  vendedor: "Amazon",
  garantiaEspana: true,
  enlace: "https://www.amazon.es/dp/B0XXXXXXX",
  nota: null,
};

describe("Observado", () => {
  it("pinta el HTML de la nota y del vendedor como texto", () => {
    const html = renderToStaticMarkup(
      <Observado o={{ ...BASE, vendedor: '<img src=x onerror="alert(1)">', nota: "<script>alert(1)</script>" }} />,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("pinta el enlace válido con rel noopener noreferrer nofollow", () => {
    const html = renderToStaticMarkup(<Observado o={BASE} />);
    expect(html).toContain('href="https://www.amazon.es/dp/B0XXXXXXX"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "https://amazon.es.evil.com/", "https://u:p@www.amazon.es/"])(
    "vuelve a comprobar el enlace al pintarlo y no pinta %s",
    (enlace) => {
      const html = renderToStaticMarkup(<Observado o={{ ...BASE, enlace }} />);
      expect(html).not.toContain("<a");
      expect(html).not.toContain(enlace);
    },
  );
});

describe("Grafica", () => {
  it("es SVG sin scripts, con la línea del objetivo y un punto por día", () => {
    const html = renderToStaticMarkup(
      <Grafica
        puntos={[
          { dia: "2026-11-10", precio: 150 },
          { dia: "2026-11-12", precio: 135 },
        ]}
        objetivo={140}
      />,
    );
    expect(html).toContain("<svg");
    expect(html).not.toContain("<script");
    expect(html.match(/<circle/g)).toHaveLength(2);
    expect(html).toContain('class="objetivo"');
  });

  it("sin puntos no pinta nada", () => {
    expect(renderToStaticMarkup(<Grafica puntos={[]} objetivo={140} />)).toBe("");
  });
});
