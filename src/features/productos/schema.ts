import { z } from "zod";

/** Producto terminado (identidad, sin precio ni costo — spec §3.1, D-04). */
export const productoInput = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio.").max(40),
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  rubroId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  presentacion: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  stockMinimo: z.coerce.number().int("Entero.").min(0, "No puede ser negativo."),
  online: z.boolean(),
  activo: z.boolean(),
});
export type ProductoInput = z.infer<typeof productoInput>;

/** Línea de receta: físico puro (spec §1.3). */
export const recetaLineaInput = z.object({
  insumoId: z.uuid("Elegí un insumo."),
  cantidadPorUnidad: z.coerce.number().positive("Mayor a 0."),
});

/** Nueva versión de receta: cierra la anterior (spec §3.1). */
export const nuevaRecetaInput = z.object({
  productoId: z.uuid(),
  vigenteDesde: z.string().min(1, "La fecha de vigencia es obligatoria."),
  notas: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : null)),
  lineas: z.array(recetaLineaInput).min(1, "Cargá al menos una línea."),
});
export type NuevaRecetaInput = z.infer<typeof nuevaRecetaInput>;
