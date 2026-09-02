import { z } from "zod";

export const TIPO_MOVIMIENTO = [
  "ingreso",
  "venta",
  "consignacion",
  "canje",
  "presentacion",
  "regalo",
  "rotura",
  "devolucion_consignacion",
  "ajuste",
  "produccion",
] as const;

export type TipoMovimiento = (typeof TIPO_MOVIMIENTO)[number];

/** Tipos que el usuario carga a mano (produccion se genera desde su módulo). */
export type TipoMovimientoManual = Exclude<TipoMovimiento, "produccion">;

export const TIPO_MOVIMIENTO_MANUAL: TipoMovimientoManual[] = [
  "ingreso",
  "venta",
  "consignacion",
  "canje",
  "presentacion",
  "regalo",
  "rotura",
  "devolucion_consignacion",
  "ajuste",
];

export const TIPO_LABEL: Record<TipoMovimiento, string> = {
  ingreso: "Ingreso",
  venta: "Venta",
  consignacion: "Consignación",
  canje: "Canje",
  presentacion: "Presentación",
  regalo: "Regalo",
  rotura: "Rotura / Defectuoso",
  devolucion_consignacion: "Devolución de consignación",
  ajuste: "Ajuste de stock",
  produccion: "Producción",
};

/**
 * Tabla de reglas por tipo de movimiento (el comportamiento del motor de
 * stock sale de acá, no de if sueltos).
 */
export type ReglaMovimiento = {
  tipo: TipoMovimiento;
  /**
   * Efecto sobre el stock por ítem. `ajuste` fija al objetivo;
   * `produccion` lo resuelve por ítem (insumo −, terminado +).
   */
  signo: 1 | -1 | "ajuste" | "produccion";
  medioPago: "requerido" | "opcional" | "no";
  tercero:
    | "proveedor-requerido"
    | "cliente-requerido"
    | "cliente-opcional"
    | "ninguno";
  actualizaCosto: boolean;
  /** Determina el total del movimiento (por defecto se suma precio×cant). */
  total: "suma-precio" | "costo" | "ajuste" | "cero";
  requiereNotas: boolean;
  /** Crea una consignación pendiente (módulo H). */
  creaConsignacion?: boolean;
};

export const REGLAS_MOVIMIENTO: ReglaMovimiento[] = [
  {
    tipo: "ingreso",
    signo: 1,
    medioPago: "opcional",
    tercero: "proveedor-requerido",
    actualizaCosto: true,
    total: "costo",
    requiereNotas: false,
  },
  {
    tipo: "venta",
    signo: -1,
    medioPago: "requerido",
    tercero: "cliente-opcional",
    actualizaCosto: false,
    total: "suma-precio",
    requiereNotas: false,
  },
  {
    tipo: "consignacion",
    signo: -1,
    medioPago: "no",
    tercero: "cliente-requerido",
    actualizaCosto: false,
    total: "cero",
    requiereNotas: false,
    creaConsignacion: true,
  },
  {
    tipo: "canje",
    signo: -1,
    medioPago: "no",
    tercero: "cliente-opcional",
    actualizaCosto: false,
    total: "cero",
    requiereNotas: false,
  },
  {
    tipo: "presentacion",
    signo: -1,
    medioPago: "no",
    tercero: "cliente-opcional",
    actualizaCosto: false,
    total: "cero",
    requiereNotas: false,
  },
  {
    tipo: "regalo",
    signo: -1,
    medioPago: "no",
    tercero: "cliente-opcional",
    actualizaCosto: false,
    total: "cero",
    requiereNotas: false,
  },
  {
    tipo: "rotura",
    signo: -1,
    medioPago: "no",
    tercero: "ninguno",
    actualizaCosto: false,
    total: "cero",
    requiereNotas: false,
  },
  {
    tipo: "devolucion_consignacion",
    signo: 1,
    medioPago: "no",
    tercero: "cliente-requerido",
    actualizaCosto: false,
    total: "cero",
    requiereNotas: false,
  },
  {
    tipo: "ajuste",
    signo: "ajuste",
    medioPago: "no",
    tercero: "ninguno",
    actualizaCosto: false,
    total: "ajuste",
    requiereNotas: true,
  },
  {
    // Se genera desde el módulo Producción, no desde el form manual.
    // El signo se resuelve por ítem (insumo resta, terminado suma).
    tipo: "produccion",
    signo: "produccion",
    medioPago: "no",
    tercero: "ninguno",
    actualizaCosto: false,
    total: "costo",
    requiereNotas: false,
  },
];

export const reglaDe = (tipo: TipoMovimiento): ReglaMovimiento =>
  REGLAS_MOVIMIENTO.find((r) => r.tipo === tipo)!;

export const signoDe = (
  tipo: TipoMovimiento,
): 1 | -1 | "ajuste" | "produccion" => reglaDe(tipo).signo;

/** Signo numérico para tipos de efecto fijo (+1 entra / −1 sale). */
export function signoNumerico(regla: ReglaMovimiento): 1 | -1 {
  if (regla.signo === 1 || regla.signo === -1) return regla.signo;
  throw new Error(`El tipo "${regla.tipo}" no tiene signo fijo.`);
}

export const itemMovimientoInput = z
  .object({
    key: z.string(),
    varianteId: z.string().uuid("Elegí una variante."),
    cantidad: z.coerce.number().int("Entero.").min(1, "Cantidad mínima 1."),
    precioUnit: z.coerce.number().min(0).default(0),
    costoUnit: z.coerce.number().min(0).default(0),
  })
  .strict();
export type ItemMovimientoInput = z.infer<typeof itemMovimientoInput>;

export const movimientoInput = z.object({
  tipo: z.enum([
    "ingreso",
    "venta",
    "consignacion",
    "canje",
    "presentacion",
    "regalo",
    "rotura",
    "devolucion_consignacion",
    "ajuste",
  ]),
  fecha: z.string().min(1, "La fecha es obligatoria."),
  clienteId: z
    .union([z.uuid(), z.literal(""), z.literal("__none__")])
    .optional()
    .transform((v) => (v && v !== "__none__" ? v : null)),
  proveedorId: z
    .union([z.uuid(), z.literal(""), z.literal("__none__")])
    .optional()
    .transform((v) => (v && v !== "__none__" ? v : null)),
  medioPagoId: z
    .union([z.uuid(), z.literal(""), z.literal("__none__")])
    .optional()
    .transform((v) => (v && v !== "__none__" ? v : null)),
  notas: z.string().trim().max(1000).optional().transform((v) => (v ? v : null)),
  items: z.array(itemMovimientoInput).min(1, "Cargá al menos un ítem."),
});

export type MovimientoInput = z.infer<typeof movimientoInput>;
