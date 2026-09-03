/** Helpers de formato para pantalla. */

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Acepta number o el string que devuelve Drizzle para `numeric`. */
export function fmtMoney(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return pesos.format(Number.isFinite(n) ? n : 0);
}

export function fmtNumber(
  value: number | string | null | undefined,
  decimals = 0,
): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Cantidad con unidad: kg con 4 decimales, u sin decimales. */
export function fmtCantidad(
  value: number | string | null | undefined,
  unidad: "kg" | "u",
): string {
  return `${fmtNumber(value, unidad === "kg" ? 4 : 0)} ${unidad}`;
}

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
