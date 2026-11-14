import Link from "next/link";
import { MODULOS } from "@/modulos";

export default function Inicio() {
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
