import { type NextRequest, NextResponse } from "next/server";

// Next.js mete scripts en línea con los datos de React: el nonce de cada petición los deja pasar sin 'unsafe-inline'.
// En desarrollo React necesita eval; en producción, no.
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const evalDesarrollo = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${evalDesarrollo}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const cabeceras = new Headers(request.headers);
  cabeceras.set("Content-Security-Policy", csp);
  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = {
  matcher: [{ source: "/((?!api/|_next/static|favicon.ico).*)" }],
};
