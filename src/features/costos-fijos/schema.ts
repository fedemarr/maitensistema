import { z } from "zod";

export const CATEGORIAS_COSTO_FIJO = [
  "alquiler",
  "sueldos",
  "servicios",
  "impuestos",
  "marketing",
  "seguros",
  "otros",
] as const;
export type CategoriaCostoFijo = (typeof CATEGORIAS_COSTO_FIJO)[number];

export const CATEGORIA_LABEL: Record<CategoriaCostoFijo, string> = {
  alquiler: "Alquiler",
  sueldos: "Sueldos",
  servicios: "Servicios",
  impuestos: "Impuestos",
  marketing: "Marketing",
  seguros: "Seguros",
  otros: "Otros",
};

export const costoFijoInput = z.object({
  concepto: z.string().trim().min(1, "El concepto es obligatorio.").max(120),
  categoria: z.enum(CATEGORIAS_COSTO_FIJO),
  montoMensual: z.coerce.number().min(0, "No puede ser negativo."),
  vigenteDesde: z.string().min(1, "La fecha es obligatoria."),
  notas: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});
export type CostoFijoInput = z.infer<typeof costoFijoInput>;

export const nuevaVersionCostoFijoInput = z.object({
  costoFijoId: z.uuid(),
  montoMensual: z.coerce.number().min(0, "No puede ser negativo."),
  categoria: z.enum(CATEGORIAS_COSTO_FIJO),
  vigenteDesde: z.string().min(1, "La fecha es obligatoria."),
  notas: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});
export type NuevaVersionCostoFijoInput = z.infer<
  typeof nuevaVersionCostoFijoInput
>;
