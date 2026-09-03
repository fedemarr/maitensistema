/**
 * Helpers del modelo de stock (spec §1, §5).
 * FIFO por lote + PPP móvil por producto.
 */

export type LoteExistencia = { loteId: string; unidades: number };
export type TomaLote = { loteId: string; cantidad: number };

/**
 * Reparte `cantidad` entre `lotes` (ordenados del más viejo al más nuevo).
 * Devuelve las tomas por lote y cuánto quedó sin cubrir (`faltante`).
 */
export function tomarFifo(
  lotes: LoteExistencia[],
  cantidad: number,
): { tomas: TomaLote[]; faltante: number } {
  const tomas: TomaLote[] = [];
  let restante = cantidad;
  for (const l of lotes) {
    if (restante <= 0) break;
    const t = Math.min(l.unidades, restante);
    if (t > 0) {
      tomas.push({ loteId: l.loteId, cantidad: t });
      restante -= t;
    }
  }
  return { tomas, faltante: Math.max(0, restante) };
}

/** PPP móvil tras una entrada valorizada. */
export function pppMovil(
  stockAntes: number,
  pppAntes: number,
  unidadesEntran: number,
  costoTotalEntra: number,
): number {
  const total = stockAntes + unidadesEntran;
  if (total <= 0) return pppAntes;
  return (stockAntes * pppAntes + costoTotalEntra) / total;
}

/** PPP tras una compra de insumo (promedio ponderado por cantidad). */
export function pppCompra(
  stockAntes: number,
  pppAntes: number,
  cantidadCompra: number,
  costoTotalCompra: number,
): number {
  const total = stockAntes + cantidadCompra;
  if (total <= 0) return pppAntes;
  return (stockAntes * pppAntes + costoTotalCompra) / total;
}

/** Ingreso neto de IVA (21%). */
export const ingresoNeto = (cantidad: number, precioConIva: number) =>
  (cantidad * precioConIva) / 1.21;

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round4 = (n: number) => Math.round(n * 10000) / 10000;
