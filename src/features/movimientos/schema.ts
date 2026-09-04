import { z } from "zod";

export const MEDIOS_PAGO = [
  "efectivo",
  "transferencia",
  "mercado_pago",
  "tienda_nube",
  "credito",
] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];
export const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
  tienda_nube: "Tienda Nube",
  credito: "Crédito (cta. cte.)",
};

/** Tipos de movimiento que el usuario crea a mano (produccion la genera Producción). */
export const TIPOS_MANUAL = [
  "venta",
  "venta_consignacion",
  "consignacion",
  "devolucion_consignacion",
  "canje",
  "presentacion",
  "regalo",
  "rotura",
  "sorteo",
  "tester",
  "co_branding",
  "influencer",
  "prueba",
  "ajuste",
] as const;
export type TipoManual = (typeof TIPOS_MANUAL)[number];

export const TIPO_LABEL: Record<TipoManual | "produccion", string> = {
  venta: "Venta",
  venta_consignacion: "Venta desde consignación",
  consignacion: "Consignación",
  devolucion_consignacion: "Devolución de consignación",
  canje: "Canje",
  presentacion: "Presentación",
  regalo: "Regalo",
  rotura: "Rotura / Defectuoso",
  sorteo: "Sorteo",
  tester: "Tester",
  co_branding: "Co-branding",
  influencer: "Influencer",
  prueba: "Prueba",
  ajuste: "Ajuste de stock",
  produccion: "Producción",
};

export type Impacto =
  | "ingreso"
  | "salida_no_venta"
  | "co_branding"
  | "neutro"
  | "ajuste";

export const IMPACTO_LABEL: Record<Impacto, string> = {
  ingreso: "Ingreso + CMV (venta)",
  salida_no_venta: "Costo de salida no-venta",
  co_branding: "Acción comercial — co-branding (a costo)",
  neutro: "Movimiento de stock (no descuenta el total propio)",
  ajuste: "Ajuste: si resta, pérdida; si suma, entra al PPP vigente",
};

export type Regla = {
  /** Efecto sobre `stock_lotes` (depósito). */
  deposito: "resta" | "no" | "ajuste";
  /** Manejo de consignaciones. */
  consig: "entregar" | "vender" | "devolver" | null;
  impacto: Impacto;
  pidePrecio: boolean;
  pideMedioPago: boolean;
  tercero: "cliente_req" | "cliente_opc" | "ninguno";
  /** El ítem lleva costo = |cantidad| × PPP. */
  generaCosto: boolean;
};

export const REGLAS: Record<TipoManual, Regla> = {
  venta: { deposito: "resta", consig: null, impacto: "ingreso", pidePrecio: true, pideMedioPago: true, tercero: "cliente_opc", generaCosto: true },
  venta_consignacion: { deposito: "no", consig: "vender", impacto: "ingreso", pidePrecio: true, pideMedioPago: true, tercero: "cliente_req", generaCosto: true },
  consignacion: { deposito: "resta", consig: "entregar", impacto: "neutro", pidePrecio: false, pideMedioPago: false, tercero: "cliente_req", generaCosto: false },
  devolucion_consignacion: { deposito: "no", consig: "devolver", impacto: "neutro", pidePrecio: false, pideMedioPago: false, tercero: "cliente_req", generaCosto: false },
  canje: { deposito: "resta", consig: null, impacto: "salida_no_venta", pidePrecio: false, pideMedioPago: false, tercero: "cliente_opc", generaCosto: true },
  presentacion: { deposito: "resta", consig: null, impacto: "salida_no_venta", pidePrecio: false, pideMedioPago: false, tercero: "cliente_opc", generaCosto: true },
  regalo: { deposito: "resta", consig: null, impacto: "salida_no_venta", pidePrecio: false, pideMedioPago: false, tercero: "cliente_opc", generaCosto: true },
  rotura: { deposito: "resta", consig: null, impacto: "salida_no_venta", pidePrecio: false, pideMedioPago: false, tercero: "ninguno", generaCosto: true },
  sorteo: { deposito: "resta", consig: null, impacto: "salida_no_venta", pidePrecio: false, pideMedioPago: false, tercero: "cliente_opc", generaCosto: true },
  tester: { deposito: "resta", consig: null, impacto: "salida_no_venta", pidePrecio: false, pideMedioPago: false, tercero: "cliente_opc", generaCosto: true },
  co_branding: { deposito: "resta", consig: null, impacto: "co_branding", pidePrecio: false, pideMedioPago: false, tercero: "cliente_opc", generaCosto: true },
  influencer: { deposito: "resta", consig: null, impacto: "salida_no_venta", pidePrecio: false, pideMedioPago: false, tercero: "cliente_opc", generaCosto: true },
  prueba: { deposito: "resta", consig: null, impacto: "salida_no_venta", pidePrecio: false, pideMedioPago: false, tercero: "ninguno", generaCosto: true },
  ajuste: { deposito: "ajuste", consig: null, impacto: "ajuste", pidePrecio: false, pideMedioPago: false, tercero: "ninguno", generaCosto: true },
};

export const reglaDe = (t: TipoManual) => REGLAS[t];

const nuevoClienteInput = z.object({
  nombre: z.string().trim().min(1).max(160),
  tipo: z.enum([
    "particular",
    "veterinaria",
    "pet_shop",
    "distribuidor",
    "marca_aliada",
    "prensa_influencer",
  ]),
});

export const itemMovimientoInput = z.object({
  productoId: z.uuid("Elegí un producto."),
  cantidad: z.coerce.number().int("Entero."),
  precioConIva: z.coerce.number().min(0).optional(),
});

export const movimientoInput = z.object({
  tipo: z.enum(TIPOS_MANUAL),
  fecha: z.string().min(1, "La fecha es obligatoria."),
  clienteId: z
    .union([z.uuid(), z.literal(""), z.literal("__none__"), z.literal("__new__")])
    .optional()
    .transform((v) => (v && v !== "__none__" && v !== "__new__" ? v : null)),
  nuevoCliente: nuevoClienteInput.optional(),
  medioPago: z.enum(MEDIOS_PAGO).optional().nullable(),
  loteId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  observaciones: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v ? v : null)),
  items: z.array(itemMovimientoInput).min(1, "Agregá al menos un ítem."),
});
export type MovimientoInput = z.infer<typeof movimientoInput>;
