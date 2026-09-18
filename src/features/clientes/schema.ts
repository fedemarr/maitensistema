import { z } from "zod";

export const tipoClienteEnum = [
  "particular",
  "veterinaria",
  "pet_shop",
  "distribuidor",
  "marca_aliada",
  "prensa_influencer",
] as const;

export type TipoCliente = (typeof tipoClienteEnum)[number];

export const TIPO_LABEL: Record<TipoCliente, string> = {
  particular: "Particular",
  veterinaria: "Veterinaria",
  pet_shop: "Pet shop",
  distribuidor: "Distribuidor / mayorista",
  marca_aliada: "Marca aliada",
  prensa_influencer: "Prensa / influencer",
};

/** Condición frente al IVA (AFIP/ARCA). Define Factura A (RI) vs B (resto). */
export const condicionIvaEnum = [
  "responsable_inscripto",
  "monotributo",
  "exento",
  "consumidor_final",
] as const;

export type CondicionIva = (typeof condicionIvaEnum)[number];

export const CONDICION_IVA_LABEL: Record<CondicionIva, string> = {
  responsable_inscripto: "Responsable Inscripto",
  monotributo: "Monotributo",
  exento: "Exento",
  consumidor_final: "Consumidor Final",
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
  condicionIva: z.enum(condicionIvaEnum).default("consumidor_final"),
  notas: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type ClienteInput = z.infer<typeof clienteInput>;
