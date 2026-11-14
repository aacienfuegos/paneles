import { bd } from "@/nucleo/bd";

export const dynamic = "force-dynamic";

export function GET(): Response {
  try {
    bd().prepare("SELECT 1").get();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "bd", detalle: "la base de datos no responde" }, { status: 503 });
  }
}
