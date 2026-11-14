import type { z } from "zod";
import { bd } from "@/nucleo/bd";
import { autenticar } from "@/nucleo/tokens";

export const MAX_CUERPO = 16 * 1024;

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LECTURAS = new Set(["GET", "HEAD"]);

export interface Autor {
  readonly agente: string;
  readonly run: string | null;
}

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    readonly detalle: string,
  ) {
    super(detalle);
  }
}

export function error(estado: number, codigo: string, detalle: string): Response {
  return Response.json({ error: codigo, detalle }, { status: estado });
}

// Lee el cuerpo por trozos y corta al pasar del límite: Content-Length puede faltar o mentir.
export async function leerJson(req: Request): Promise<unknown> {
  const demasiado = new ErrorApi(413, "demasiado_grande", `el cuerpo pasa de ${MAX_CUERPO} bytes`);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_CUERPO) throw demasiado;
  const lector = req.body?.getReader();
  if (lector === undefined) throw new ErrorApi(400, "json_invalido", "falta el cuerpo");
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CUERPO) {
      await lector.cancel();
      throw demasiado;
    }
    trozos.push(value);
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(trozos)));
  } catch {
    throw new ErrorApi(400, "json_invalido", "el cuerpo no es JSON válido en UTF-8");
  }
}

export function validar<T extends z.ZodType>(esquema: T, valor: unknown): z.output<T> {
  const r = esquema.safeParse(valor);
  if (r.success) return r.data;
  const [problema] = r.error.issues;
  const ruta = problema.path.join(".") || "cuerpo";
  throw new ErrorApi(400, "validacion", `${ruta}: ${problema.message}`);
}

function registrar(req: Request, autor: Autor, codigo: number): void {
  bd()
    .prepare("INSERT INTO escrituras (hora, agente, run, metodo, ruta, codigo) VALUES (?, ?, ?, ?, ?, ?)")
    .run(new Date().toISOString(), autor.agente, autor.run, req.method, new URL(req.url).pathname, codigo);
}

type Manejador<P> = (req: Request, autor: Autor, params: P) => Response | Promise<Response>;

// Autenticación, permiso por panel, errores y registro de escrituras, iguales para todos los módulos.
export function protegida<P = unknown>(panel: string, manejar: Manejador<P>) {
  return async (req: Request, ruta: { readonly params: Promise<P> }): Promise<Response> => {
    const quien = autenticar(bd(), req.headers.get("authorization"));
    if (quien === null) return error(401, "no_autenticado", "falta el token o no es válido");
    const run = req.headers.get("x-paperclip-run-id");
    const autor: Autor = { agente: quien.agente, run: run !== null && RUN_ID.test(run) ? run : null };
    let codigo = 500;
    try {
      const respuesta = quien.paneles.includes(panel)
        ? await manejar(req, autor, await ruta.params)
        : error(403, "prohibido", `el token no sirve para el panel ${panel}`);
      codigo = respuesta.status;
      return respuesta;
    } catch (e) {
      if (!(e instanceof ErrorApi)) throw e;
      codigo = e.estado;
      return error(e.estado, e.codigo, e.detalle);
    } finally {
      if (!LECTURAS.has(req.method)) registrar(req, autor, codigo);
    }
  };
}
