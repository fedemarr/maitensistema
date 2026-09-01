import { z } from "zod";

const opt = (max = 120) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const varianteInput = z.object({
  id: z.uuid().optional(),
  nombre: z.string().trim().min(1, "Poné un nombre (ej: 250 ml).").max(80),
  presentacion: opt(60),
  fragancia: opt(60),
  stock: z.coerce.number().int("Entero.").min(0, "No puede ser negativo."),
  stockMin: z.coerce.number().int("Entero.").min(0, "No puede ser negativo."),
  costoPromedio: z.coerce.number().min(0, "No puede ser negativo."),
});

export const productoInput = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio.").max(40),
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  rubroId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  precioLista: z.coerce.number().min(0, "No puede ser negativo."),
  online: z.boolean(),
  activo: z.boolean(),
  fotoPath: opt(300),
  variantes: z.array(varianteInput).min(1, "Cargá al menos una variante."),
});

export type ProductoInput = z.infer<typeof productoInput>;
export type VarianteInput = z.infer<typeof varianteInput>;
