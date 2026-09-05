import { z } from "zod";

/** Códigos del plan de cuentas (seed en drizzle/0003). */
export const CUENTAS = {
  caja: "1.1.1",
  banco: "1.1.2",
  mercaderia: "1.1.3",
  deudoresPorVentas: "1.1.4",
  mercaderiaConsignacion: "1.1.5",
  proveedoresAPagar: "2.1.1",
  capitalInicial: "3.1.1",
  ventas: "4.1.1",
  cmv: "5.1.1",
  gastosOperativos: "5.1.2",
  fabricacion: "5.1.3",
  perdidaInsumos: "5.1.4",
} as const;

export const TIPO_CUENTA = ["activo", "pasivo", "pn", "rpos", "rneg"] as const;
export type TipoCuenta = (typeof TIPO_CUENTA)[number];

export const TIPO_CUENTA_LABEL: Record<TipoCuenta, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  pn: "Patrimonio Neto",
  rpos: "Resultado Positivo",
  rneg: "Resultado Negativo",
};

export const ORIGEN_ASIENTO_LABEL: Record<string, string> = {
  movimiento: "Movimiento",
  produccion: "Producción",
  compra: "Compra de insumos",
  cobro: "Cobro",
  pago: "Pago",
  baja: "Baja de insumo",
  manual: "Manual",
};

const codigoSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)+$/, "Código jerárquico, ej. 1.1.1");

export const cuentaInput = z
  .object({
    codigo: codigoSchema,
    nombre: z.string().trim().min(1, "Poné un nombre.").max(80),
    rubro: z.string().trim().min(1, "Poné el rubro.").max(80),
    tipo: z.enum(TIPO_CUENTA),
  })
  .strict();
export type CuentaInput = z.infer<typeof cuentaInput>;

export const editarCuentaInput = cuentaInput
  .extend({ id: z.uuid() })
  .strict();
export type EditarCuentaInput = z.infer<typeof editarCuentaInput>;

/** Redondea al centavo (los montos se guardan como string en Postgres). */
export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
