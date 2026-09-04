import { z } from "zod";

export const ESTADO_ORDEN = ["planificada", "cerrada", "anulada"] as const;
export type EstadoOrden = (typeof ESTADO_ORDEN)[number];

export const ESTADO_LABEL: Record<EstadoOrden, string> = {
  planificada: "Planificada",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

export const planificarInput = z.object({
  productoId: z.uuid("Elegí el producto a fabricar."),
  loteId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  nuevoLoteNombre: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : null)),
  cantidad: z.coerce.number().int("Entero.").positive("Mayor a 0."),
  fechaPrevista: z.string().min(1, "La fecha es obligatoria."),
  fabricacionCotizada: z.coerce.number().min(0, "No puede ser negativo."),
});
export type PlanificarInput = z.infer<typeof planificarInput>;

export const cerrarOrdenInput = z.object({
  ordenId: z.uuid(),
  unidadesObtenidas: z.coerce.number().int("Entero.").positive("Mayor a 0."),
  fabricacionCobrada: z.coerce.number().min(0, "No puede ser negativo."),
  consumos: z
    .array(
      z.object({
        insumoId: z.uuid(),
        consumoReal: z.coerce.number().min(0, "No puede ser negativo."),
      }),
    )
    .min(1),
});
export type CerrarOrdenInput = z.infer<typeof cerrarOrdenInput>;
