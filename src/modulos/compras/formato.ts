const EUROS = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function euros(n: number): string {
  return EUROS.format(n);
}

export function garantia(g: boolean | null): string {
  if (g === null) return "garantía en España: no consta";
  return g ? "con garantía en España" : "sin garantía en España";
}
