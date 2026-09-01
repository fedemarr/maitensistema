import { z } from "zod";

export const tipoClienteEnum = [
  "veterinaria",
  "peluqueria",
  "influencer",
  "mayorista",
  "particular",
] as const;

export const TIPO_LABEL: Record<(typeof tipoClienteEnum)[number], string> = {
  veterinaria: "Veterinaria",
  peluqueria: "Peluquería",
  influencer: "Influencer",
  mayorista: "Mayorista",
  particular: "Particular",
};

export const clienteInput = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  tipo: z.enum(tipoClienteEnum),
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
  cuit: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  notas: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type ClienteInput = z.infer<typeof clienteInput>;