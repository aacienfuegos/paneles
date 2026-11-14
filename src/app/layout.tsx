import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Paneles" };

export default function Layout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
