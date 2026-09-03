import { z } from "zod";

export const MOTIVO_BAJA = [
  "vencido",
  "secado",
  "no_reutilizable",
  "rotura",
  "ajuste_inventario",
] as const;
export type MotivoBaja = (typeof MOTIVO_BAJA)[number];

export const MOTIVO_LABEL: Record<MotivoBaja, string> = {
  vencido: "Vencido",
  secado: "Secado / inutilizable",
  no_reutilizable: "No reutilizable (sanitario)",
  rotura: "Rotura / derrame",
  ajuste_inventario: "Ajuste de inventario",
};

const opt = (max = 40) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const insumoInput = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio.").max(40),
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(160),
  unidad: z.enum(["kg", "u"]),
  reutilizable: z.boolean(),
  vence: z.boolean(),
  proveedorHabitualId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  activo: z.boolean(),
});
export type InsumoInput = z.infer<typeof insumoInput>;

/** Compra en tanda: una fila por insumo comprado (spec §3.2). */
export const compraLineaInput = z.object({
  insumoId: z.uuid(),
  cantidad: z.coerce.number().positive("Mayor a 0."),
  costoTotal: z.coerce.number().min(0, "No puede ser negativo."),
  vencimiento: opt(10),
});

export const compraInput = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria."),
  proveedorId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  loteId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  nuevoLoteNombre: opt(80),
  lineas: z.array(compraLineaInput).min(1, "Cargá al menos una línea."),
});
export type CompraInput = z.infer<typeof compraInput>;

export const bajaInput = z.object({
  fecha: z.string().min(1, "La fecha es obligatoria."),
  insumoId: z.uuid("Elegí un insumo."),
  cantidad: z.coerce.number().positive("Mayor a 0."),
  motivo: z.enum(MOTIVO_BAJA),
  loteId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
});
export type BajaInput = z.infer<typeof bajaInput>;
