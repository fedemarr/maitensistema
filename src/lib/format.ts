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
  let d: Date;
  if (typeof value === "string") {
    // "YYYY-MM-DD" (lo que devuelve Drizzle para `date`): parsear como fecha
    // local, no UTC. `new Date("YYYY-MM-DD")` cae a medianoche UTC, que en
    // husos negativos (Argentina) muestra el día anterior.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  } else {
    d = value;
  }
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
