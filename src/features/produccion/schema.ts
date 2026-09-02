import { z } from "zod";

export const ESTADO_ORDEN = [
  "borrador",
  "en_proceso",
  "completada",
  "anulada",
] as const;
export type EstadoOrden = (typeof ESTADO_ORDEN)[number];

export const ESTADO_ORDEN_LABEL: Record<EstadoOrden, string> = {
  borrador: "Borrador",
  en_proceso: "En proceso",
  completada: "Completada",
  anulada: "Anulada",
};

export const ordenInput = z.object({
  varianteTerminadoId: z.string().uuid("Elegí el producto a fabricar."),
  cantidad: z.coerce.number().int("Entero.").positive("Cantidad a producir > 0."),
  fecha: z.string().min(1, "La fecha es obligatoria."),
  notas: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type OrdenInput = z.infer<typeof ordenInput>;

/**
 * Consumo real de un insumo para una orden.
 * `receta.cantidad` es por lote base (rinde); se escala a la cantidad pedida,
 * se le suma la merma y se redondea HACIA ARRIBA (el stock de insumos es
 * entero; ver docs/fase-3-estado.md).
 */
export function consumoInsumo(
  cantidadReceta: number,
  mermaPct: number,
  rinde: number,
  cantidadOrden: number,
): number {
  const base = (cantidadReceta * cantidadOrden) / rinde;
  return Math.ceil(base * (1 + mermaPct / 100));
}
