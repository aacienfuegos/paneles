import Link from "next/link";
import { connection } from "next/server";
import { MODULOS } from "@/modulos";

// Dinámica, como todas: la CSP lleva un nonce por petición y una página estática saldría sin él.
export default async function Inicio() {
  await connection();
  return (
    <main>
      <h1>Paneles</h1>
      <ul>
        {MODULOS.map((m) => (
          <li key={m.id}>
            <Link href={`/${m.id}`}>{m.titulo}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
