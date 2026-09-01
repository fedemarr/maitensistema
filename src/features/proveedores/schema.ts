import { z } from "zod";

export const proveedorInput = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  cuit: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  telefono: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  notas: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type ProveedorInput = z.infer<typeof proveedorInput>;
