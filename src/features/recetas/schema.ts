import { z } from "zod";

export const recetaItemInput = z.object({
  varianteInsumoId: z.string().uuid("Elegí un insumo."),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0."),
  mermaPct: z.coerce.number().min(0, "Mínimo 0.").max(100, "Máximo 100.").default(0),
});

export const recetaInput = z.object({
  varianteTerminadoId: z.string().uuid(),
  /** Unidades de terminado que rinde el lote base descripto en items. */
  rinde: z.coerce.number().int("Entero.").positive("El rinde es al menos 1."),
  notas: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
  items: z.array(recetaItemInput).min(1, "Cargá al menos un insumo."),
});

export type RecetaInput = z.infer<typeof recetaInput>;
export type RecetaItemInput = z.infer<typeof recetaItemInput>;
