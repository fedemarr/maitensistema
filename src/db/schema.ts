import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ─────────────────────────────────────────────────────────────
 * Esquema normalizado — primer corte (Fase 1).
 * Cubre el núcleo comercial. Contabilidad (asientos / plan de
 * cuentas), consignaciones y cuentas corrientes se agregan en
 * Fase 2 con sus propias tablas.
 *
 * Convención: TypeScript en camelCase, Postgres en snake_case
 * (drizzle mapea solo, ver `casing` en drizzle.config.ts).
 * ───────────────────────────────────────────────────────────── */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ── Enums ──────────────────────────────────────────────────── */

export const rolUsuario = pgEnum("rol_usuario", ["admin", "ventas", "lectura"]);

export const tipoCliente = pgEnum("tipo_cliente", [
  "veterinaria",
  "peluqueria",
  "influencer",
  "mayorista",
  "particular",
]);

/** Los 8 tipos de movimiento del negocio (spec de Lautaro) + ajuste + producción. */
export const tipoMovimiento = pgEnum("tipo_movimiento", [
  "ingreso", // compra a proveedor / alta de stock
  "venta",
  "consignacion", // sale stock, no cobra
  "canje", // producto por servicio / posteo
  "presentacion", // muestra a veterinaria
  "regalo",
  "rotura", // defectuoso / baja
  "devolucion_consignacion",
  "ajuste", // fija el stock a un valor contado / corrige (requiere notas)
  "produccion", // consume insumos y da de alta producto terminado (módulo Producción)
]);

export const estadoOrdenProduccion = pgEnum("estado_orden_produccion", [
  "borrador",
  "en_proceso",
  "completada",
  "anulada",
]);

/* ── Perfiles (espejo de auth.users) ───────────────────────── */

export const perfiles = pgTable("perfiles", {
  // Igual al id de auth.users. La FK a auth.users se define en la migración SQL.
  id: uuid("id").primaryKey(),
  nombre: text("nombre").notNull(),
  rol: rolUsuario("rol").notNull().default("lectura"),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
});

/* ── Catálogo ──────────────────────────────────────────────── */

export const rubros = pgTable("rubros", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
});

export const productos = pgTable("productos", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").notNull().unique(),
  nombre: text("nombre").notNull(),
  rubroId: uuid("rubro_id").references(() => rubros.id, {
    onDelete: "set null",
  }),
  precioLista: numeric("precio_lista", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  online: boolean("online").notNull().default(false),
  activo: boolean("activo").notNull().default(true),
  /** true = materia prima / insumo; false = producto terminado. */
  esInsumo: boolean("es_insumo").notNull().default(false),
  /** Ruta del archivo en Supabase Storage (bucket `productos`). */
  fotoPath: text("foto_path"),
  ...timestamps,
});

/**
 * Variante = presentación concreta de un producto.
 * Reemplaza el modelo "talle / color" heredado del club por
 * "presentación / fragancia" (ambos opcionales).
 */
export const variantes = pgTable("variantes", {
  id: uuid("id").primaryKey().defaultRandom(),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(), // ej: "250 ml"
  presentacion: text("presentacion"), // ej: "250 ml", "1 L"
  fragancia: text("fragancia"), // ej: "neutra", "lavanda"
  stock: integer("stock").notNull().default(0),
  stockMin: integer("stock_min").notNull().default(0),
  costoPromedio: numeric("costo_promedio", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
}, (t) => [
  // Invariante de stock: garantía a nivel base, además del chequeo en la app.
  check("variantes_stock_no_negativo", sql`${t.stock} >= 0`),
]);

/* ── Terceros ──────────────────────────────────────────────── */

export const clientes = pgTable("clientes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  tipo: tipoCliente("tipo").notNull().default("particular"),
  email: text("email"),
  telefono: text("telefono"),
  cuit: text("cuit"),
  notas: text("notas"),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
});

export const proveedores = pgTable("proveedores", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  cuit: text("cuit"),
  email: text("email"),
  telefono: text("telefono"),
  notas: text("notas"),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
});

/* ── Movimientos ───────────────────────────────────────────── */

/** Medios de pago (Efectivo, Transferencia, Mercado Pago, Crédito…). */
export const mediosPago = pgTable("medios_pago", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  esCredito: boolean("es_credito").notNull().default(false),
  /** Cuenta contable que se debita/credita (Caja, Banco…). Null si es crédito. */
  cuentaId: uuid("cuenta_id").references(() => planCuentas.id, {
    onDelete: "set null",
  }),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
});

export const movimientos = pgTable("movimientos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipo: tipoMovimiento("tipo").notNull(),
  fecha: date("fecha").notNull().defaultNow(),
  clienteId: uuid("cliente_id").references(() => clientes.id, {
    onDelete: "set null",
  }),
  proveedorId: uuid("proveedor_id").references(() => proveedores.id, {
    onDelete: "set null",
  }),
  medioPagoId: uuid("medio_pago_id").references(() => mediosPago.id, {
    onDelete: "set null",
  }),
  /** Total en pesos. Puede ser 0 para regalo / presentación / rotura. */
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  notas: text("notas"),
  /**
   * Si la venta proviene de una consignación (módulo H), para contabilidad.
   * Sin FK a consignaciones a propósito: evita el ciclo con `consignaciones`,
   * que ya referencia a `movimientos` por `movimiento_id`.
   */
  consignacionId: uuid("consignacion_id"),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const movimientoItems = pgTable("movimiento_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  movimientoId: uuid("movimiento_id")
    .notNull()
    .references(() => movimientos.id, { onDelete: "cascade" }),
  varianteId: uuid("variante_id")
    .notNull()
    .references(() => variantes.id, { onDelete: "restrict" }),
  cantidad: integer("cantidad").notNull(),
  precioUnit: numeric("precio_unit", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  costoUnit: numeric("costo_unit", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
});

/* ── Cuentas corrientes y consignaciones (Fase 2) ──────────── */

export const ccEntidadTipo = pgEnum("cc_entidad_tipo", ["cliente", "proveedor"]);

/** Asientos de cuenta corriente de clientes y proveedores. */
export const ccMovimientos = pgTable("cc_movimientos", {
  id: uuid("id").primaryKey().defaultRandom(),
  entidadTipo: ccEntidadTipo("entidad_tipo").notNull(),
  entidadId: uuid("entidad_id").notNull(),
  fecha: date("fecha").notNull().defaultNow(),
  debe: numeric("debe", { precision: 12, scale: 2 }).notNull().default("0"),
  haber: numeric("haber", { precision: 12, scale: 2 }).notNull().default("0"),
  concepto: text("concepto"),
  movimientoId: uuid("movimiento_id").references(() => movimientos.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const estadoConsignacion = pgEnum("estado_consignacion", [
  "pendiente",
  "vendido",
  "devuelto",
]);

/* ── Contabilidad (Módulo I) ───────────────────────────────── */

export const tipoCuenta = pgEnum("tipo_cuenta", [
  "activo",
  "pasivo",
  "pn",
  "rpos",
  "rneg",
]);

/** Plan de cuentas: catálogo de cuentas contables. El seed viene en la migración. */
export const planCuentas = pgTable("plan_cuentas", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Código jerárquico, ej. "1.1.1". */
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
  rubro: text("rubro").notNull(),
  tipo: tipoCuenta("tipo").notNull(),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
});

/**
 * Asiento contable (partida doble). Los asientos automáticos derivan de un
 * movimiento o de un pago de CC; los manuales no tienen `movimientoId`.
 * `borrador` permite asientos sin confirmar; `confirmado` es definitivo.
 */
export const asientos = pgTable("asientos", {
  id: uuid("id").primaryKey().defaultRandom(),
  fecha: date("fecha").notNull().defaultNow(),
  descripcion: text("descripcion").notNull(),
  /** Origen del asiento: "movimiento" | "cc-pago" | "manual". */
  origen: text("origen").notNull(),
  estado: text("estado").notNull().default("confirmado"),
  movimientoId: uuid("movimiento_id").references(() => movimientos.id, {
    onDelete: "cascade",
  }),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

/** Líneas de un asiento: Σ debe = Σ haber por asiento confirmado. */
export const asientoLineas = pgTable("asiento_lineas", {
  id: uuid("id").primaryKey().defaultRandom(),
  asientoId: uuid("asiento_id")
    .notNull()
    .references(() => asientos.id, { onDelete: "cascade" }),
  cuentaId: uuid("cuenta_id")
    .notNull()
    .references(() => planCuentas.id, { onDelete: "restrict" }),
  debe: numeric("debe", { precision: 12, scale: 2 }).notNull().default("0"),
  haber: numeric("haber", { precision: 12, scale: 2 }).notNull().default("0"),
  concepto: text("concepto"),
  ...timestamps,
});

/** Consignación: mercadería entregada a un cliente que se cobra cuando vende. */
export const consignaciones = pgTable("consignaciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  movimientoId: uuid("movimiento_id")
    .notNull()
    .references(() => movimientos.id, { onDelete: "cascade" }),
  clienteId: uuid("cliente_id")
    .notNull()
    .references(() => clientes.id, { onDelete: "cascade" }),
  fecha: date("fecha").notNull().defaultNow(),
  venceEl: date("vence_el").notNull(),
  estado: estadoConsignacion("estado").notNull().default("pendiente"),
  cierreMovimientoId: uuid("cierre_movimiento_id").references(
    () => movimientos.id,
    { onDelete: "set null" },
  ),
  ...timestamps,
});

/* ── Producción (Fase 3) ───────────────────────────────────── */

/**
 * Receta / lista de materiales de una variante de producto terminado.
 * Al editar se desactiva la anterior y se crea una nueva (histórico).
 */
export const recetas = pgTable("recetas", {
  id: uuid("id").primaryKey().defaultRandom(),
  varianteTerminadoId: uuid("variante_terminado_id")
    .notNull()
    .references(() => variantes.id, { onDelete: "cascade" }),
  /** Unidades de terminado que produce el lote base descripto en receta_items. */
  rinde: integer("rinde").notNull().default(1),
  activa: boolean("activa").notNull().default(true),
  notas: text("notas"),
  ...timestamps,
});

export const recetaItems = pgTable("receta_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  recetaId: uuid("receta_id")
    .notNull()
    .references(() => recetas.id, { onDelete: "cascade" }),
  varianteInsumoId: uuid("variante_insumo_id")
    .notNull()
    .references(() => variantes.id, { onDelete: "restrict" }),
  /** Consumo de este insumo por lote base (antes de merma). */
  cantidad: numeric("cantidad", { precision: 14, scale: 4 }).notNull(),
  /** Merma esperada, en %. Aumenta el consumo real. */
  mermaPct: numeric("merma_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
});

export const ordenesProduccion = pgTable("ordenes_produccion", {
  id: uuid("id").primaryKey().defaultRandom(),
  varianteTerminadoId: uuid("variante_terminado_id")
    .notNull()
    .references(() => variantes.id, { onDelete: "restrict" }),
  /** Unidades de terminado a producir. */
  cantidad: integer("cantidad").notNull(),
  estado: estadoOrdenProduccion("estado").notNull().default("borrador"),
  fecha: date("fecha").notNull().defaultNow(),
  /** Movimiento `produccion` generado al completar (null hasta entonces). */
  movimientoId: uuid("movimiento_id").references(() => movimientos.id, {
    onDelete: "set null",
  }),
  notas: text("notas"),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

/* ── Auditoría ─────────────────────────────────────────────── */

export const auditoria = pgTable("auditoria", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  accion: text("accion").notNull(), // "crear" | "editar" | "borrar"
  entidad: text("entidad").notNull(), // "producto" | "movimiento" | ...
  entidadId: uuid("entidad_id"),
  datos: text("datos"), // snapshot JSON del cambio
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ── Relaciones ────────────────────────────────────────────── */

export const productosRelations = relations(productos, ({ one, many }) => ({
  rubro: one(rubros, {
    fields: [productos.rubroId],
    references: [rubros.id],
  }),
  variantes: many(variantes),
}));

export const variantesRelations = relations(variantes, ({ one, many }) => ({
  producto: one(productos, {
    fields: [variantes.productoId],
    references: [productos.id],
  }),
  items: many(movimientoItems),
}));

export const movimientosRelations = relations(movimientos, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [movimientos.clienteId],
    references: [clientes.id],
  }),
  proveedor: one(proveedores, {
    fields: [movimientos.proveedorId],
    references: [proveedores.id],
  }),
  medioPago: one(mediosPago, {
    fields: [movimientos.medioPagoId],
    references: [mediosPago.id],
  }),
  creador: one(perfiles, {
    fields: [movimientos.creadoPor],
    references: [perfiles.id],
  }),
  items: many(movimientoItems),
  consignacionOrigen: one(consignaciones, {
    fields: [movimientos.consignacionId],
    references: [consignaciones.id],
  }),
}));

export const movimientoItemsRelations = relations(movimientoItems, ({ one }) => ({
  movimiento: one(movimientos, {
    fields: [movimientoItems.movimientoId],
    references: [movimientos.id],
  }),
  variante: one(variantes, {
    fields: [movimientoItems.varianteId],
    references: [variantes.id],
  }),
}));

export const ccMovimientosRelations = relations(
  ccMovimientos,
  ({ one }) => ({
    movimiento: one(movimientos, {
      fields: [ccMovimientos.movimientoId],
      references: [movimientos.id],
    }),
  }),
);

export const consignacionesRelations = relations(consignaciones, ({ one }) => ({
  movimiento: one(movimientos, {
    fields: [consignaciones.movimientoId],
    references: [movimientos.id],
  }),
  cliente: one(clientes, {
    fields: [consignaciones.clienteId],
    references: [clientes.id],
  }),
  cierreMovimiento: one(movimientos, {
    fields: [consignaciones.cierreMovimientoId],
    references: [movimientos.id],
  }),
}));

export const asientosRelations = relations(asientos, ({ one, many }) => ({
  movimiento: one(movimientos, {
    fields: [asientos.movimientoId],
    references: [movimientos.id],
  }),
  creador: one(perfiles, {
    fields: [asientos.creadoPor],
    references: [perfiles.id],
  }),
  lineas: many(asientoLineas),
}));

export const asientoLineasRelations = relations(asientoLineas, ({ one }) => ({
  asiento: one(asientos, {
    fields: [asientoLineas.asientoId],
    references: [asientos.id],
  }),
  cuenta: one(planCuentas, {
    fields: [asientoLineas.cuentaId],
    references: [planCuentas.id],
  }),
}));

export const recetasRelations = relations(recetas, ({ one, many }) => ({
  varianteTerminado: one(variantes, {
    fields: [recetas.varianteTerminadoId],
    references: [variantes.id],
  }),
  items: many(recetaItems),
}));

export const recetaItemsRelations = relations(recetaItems, ({ one }) => ({
  receta: one(recetas, {
    fields: [recetaItems.recetaId],
    references: [recetas.id],
  }),
  varianteInsumo: one(variantes, {
    fields: [recetaItems.varianteInsumoId],
    references: [variantes.id],
  }),
}));

export const ordenesProduccionRelations = relations(
  ordenesProduccion,
  ({ one }) => ({
    varianteTerminado: one(variantes, {
      fields: [ordenesProduccion.varianteTerminadoId],
      references: [variantes.id],
    }),
    movimiento: one(movimientos, {
      fields: [ordenesProduccion.movimientoId],
      references: [movimientos.id],
    }),
    creador: one(perfiles, {
      fields: [ordenesProduccion.creadoPor],
      references: [perfiles.id],
    }),
  }),
);
