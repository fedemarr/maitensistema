/**
 * Combos de Tiendanube: un SKU de la tienda que en realidad son varios
 * productos del sistema. Cuando entra un pedido con ese SKU, la venta se
 * carga descontando cada componente por separado (FIFO de su propio lote),
 * y el precio del combo se reparte entre los componentes según el precio
 * retail vigente de cada uno.
 *
 * Clave = SKU cargado en Tiendanube (se compara en minúsculas).
 * Valor  = componentes: SKU del producto en el sistema + cuántas unidades
 *          de ese producto lleva UN combo.
 */
export const COMBOS: Record<string, { sku: string; cantidad: number }[]> = {
  // Set Crema reparadora + Shampoo
  "mai-set-cs": [
    { sku: "MAI-CR-CAL-060", cantidad: 1 },
    { sku: "MAI-SH-AR-250", cantidad: 1 },
  ],
};

/** Componentes de un combo, o `null` si ese SKU no es un combo. */
export function componentesDeCombo(
  sku: string | null | undefined,
): { sku: string; cantidad: number }[] | null {
  if (!sku) return null;
  return COMBOS[sku.toLowerCase()] ?? null;
}
