import { z } from "zod";

export const ORIGENES_CC = [
  "venta_credito",
  "compra_credito",
  "cobro",
  "pago",
  "ajuste",
] as const;
export type OrigenCc = (typeof ORIGENES_CC)[number];

export const ORIGEN_CC_LABEL: Record<OrigenCc, string> = {
  venta_credito: "Venta a crédito",
  compra_credito: "Compra a crédito",
  cobro: "Cobro",
  pago: "Pago",
  ajuste: "Ajuste manual",
};

/** Medios de pago válidos para registrar un cobro o un pago (sin Crédito). */
export const MEDIOS_PAGO_CC = [
  "efectivo",
  "transferencia",
  "mercado_pago",
] as const;

export const cobroInput = z.object({
  clienteId: z.uuid(),
  fecha: z.string().min(1, "La fecha es obligatoria."),
  monto: z.coerce.number().positive("Tiene que ser mayor a 0."),
  medioPago: z.enum(MEDIOS_PAGO_CC),
  concepto: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});
export type CobroInput = z.infer<typeof cobroInput>;

export const pagoInput = z.object({
  proveedorId: z.uuid(),
  fecha: z.string().min(1, "La fecha es obligatoria."),
  monto: z.coerce.number().positive("Tiene que ser mayor a 0."),
  medioPago: z.enum(MEDIOS_PAGO_CC),
  concepto: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});
export type PagoInput = z.infer<typeof pagoInput>;

/**
 * Ajuste manual del saldo (admin). `monto` con signo: para cliente, positivo
 * aumenta lo que debe (debe) y negativo se lo acredita (haber); para
 * proveedor, positivo aumenta lo que le debemos (haber) y negativo lo reduce
 * (debe). Mismo criterio que un ajuste de stock (± cantidad).
 */
export const ajusteCcInput = z.object({
  entidadTipo: z.enum(["cliente", "proveedor"]),
  entidadId: z.uuid(),
  fecha: z.string().min(1, "La fecha es obligatoria."),
  monto: z.coerce.number().refine((v) => v !== 0, "No puede ser 0."),
  concepto: z.string().trim().min(1, "Contá el motivo del ajuste.").max(200),
});
export type AjusteCcInput = z.infer<typeof ajusteCcInput>;
