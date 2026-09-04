import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ─────────────────────────────────────────────────────────────
 * Esquema — Fase 4 (spec funcional Maitén v1.0).
 * Modelo de stock: entradas − salidas, FIFO por lote, PPP móvil por producto.
 * Ver docs/fase-4-plan.md y docs/ESPECIFICACION_SISTEMA_MAITEN.md.
 *
 * Convención: TS camelCase, Postgres snake_case (casing en drizzle.config.ts).
 * Montos: numeric(14,2) como string. Cantidades físicas: numeric(14,4).
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

const money = (name: string) =>
  numeric(name, { precision: 14, scale: 2 }).notNull().default("0");
const qty = (name: string) =>
  numeric(name, { precision: 14, scale: 4 }).notNull().default("0");

/* ── Enums ──────────────────────────────────────────────────── */

export const rolUsuario = pgEnum("rol_usuario", ["admin", "ventas", "lectura"]);

export const tipoCliente = pgEnum("tipo_cliente", [
  "particular",
  "veterinaria",
  "pet_shop",
  "distribuidor",
  "marca_aliada",
  "prensa_influencer",
]);

export const unidadInsumo = pgEnum("unidad_insumo", ["kg", "u"]);

export const motivoBaja = pgEnum("motivo_baja_insumo", [
  "vencido",
  "secado",
  "no_reutilizable",
  "rotura",
  "ajuste_inventario",
]);

export const estadoOrden = pgEnum("estado_orden_produccion", [
  "planificada",
  "cerrada",
  "anulada",
]);

export const medioPago = pgEnum("medio_pago", [
  "efectivo",
  "transferencia",
  "mercado_pago",
  "tienda_nube",
  "credito",
]);

/**
 * Tipos de movimiento (spec §3.5). El tipo define solo: si descuenta stock y
 * cómo impacta el EERR. `produccion` la genera Producción, no el usuario.
 */
export const tipoMovimiento = pgEnum("tipo_movimiento", [
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
  "produccion",
]);

export const tipoCuenta = pgEnum("tipo_cuenta", [
  "activo",
  "pasivo",
  "pn",
  "rpos",
  "rneg",
]);

export const categoriaCostoFijo = pgEnum("categoria_costo_fijo", [
  "alquiler",
  "sueldos",
  "servicios",
  "impuestos",
  "marketing",
  "seguros",
  "otros",
]);

/** Dos listas de precio (D-04): retail y mayorista. */
export const tipoListaPrecio = pgEnum("tipo_lista_precio", [
  "retail",
  "mayorista",
]);

export const entidadCc = pgEnum("entidad_cc", ["cliente", "proveedor"]);

export const origenCc = pgEnum("origen_cc", [
  "venta_credito",
  "compra_credito",
  "cobro",
  "pago",
  "ajuste",
]);

/* ── Perfiles / catálogo base ──────────────────────────────── */

export const perfiles = pgTable("perfiles", {
  id: uuid("id").primaryKey(), // = auth.users.id (FK en setup.sql)
  nombre: text("nombre").notNull(),
  rol: rolUsuario("rol").notNull().default("lectura"),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
});

export const rubros = pgTable("rubros", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
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

/* ── Productos e insumos ───────────────────────────────────── */

/**
 * Un producto es su presentación (no hay variantes). Un insumo es un producto
 * con `es_insumo = true` y usa las columnas de insumo (reutilizable, vence,
 * unidad). `ppp` lo mantienen Producción (terminados) y las compras (insumos).
 */
export const productos = pgTable("productos", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").notNull().unique(),
  nombre: text("nombre").notNull(),
  rubroId: uuid("rubro_id").references(() => rubros.id, {
    onDelete: "set null",
  }),
  presentacion: text("presentacion"), // "250 ml" / "60 g"
  stockMinimo: integer("stock_minimo").notNull().default(0),
  online: boolean("online").notNull().default(false),
  esInsumo: boolean("es_insumo").notNull().default(false),
  activo: boolean("activo").notNull().default(true),
  /** Costo promedio ponderado móvil (terminado: por Producción; insumo: por compras). */
  ppp: money("ppp"),
  fotoPath: text("foto_path"),
  // Solo insumos:
  reutilizable: boolean("reutilizable").notNull().default(false),
  vence: boolean("vence").notNull().default(false),
  unidad: unidadInsumo("unidad"),
  /** Stock del insumo (materializado: Σ compras − consumos de órdenes − bajas). */
  stockInsumo: qty("stock_insumo"),
  proveedorHabitualId: uuid("proveedor_habitual_id").references(
    () => proveedores.id,
    { onDelete: "set null" },
  ),
  ...timestamps,
});

/* ── Recetas (físico puro, versionadas con vigencia) ───────── */

export const recetas = pgTable("recetas", {
  id: uuid("id").primaryKey().defaultRandom(),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id, { onDelete: "cascade" }),
  numero: integer("numero").notNull().default(1),
  vigenteDesde: date("vigente_desde").notNull().defaultNow(),
  vigenteHasta: date("vigente_hasta"), // null = vigente
  notas: text("notas"),
  ...timestamps,
});

export const recetaLineas = pgTable("receta_lineas", {
  id: uuid("id").primaryKey().defaultRandom(),
  recetaId: uuid("receta_id")
    .notNull()
    .references(() => recetas.id, { onDelete: "cascade" }),
  insumoId: uuid("insumo_id")
    .notNull()
    .references(() => productos.id, { onDelete: "restrict" }),
  cantidadPorUnidad: qty("cantidad_por_unidad"),
  unidad: unidadInsumo("unidad").notNull().default("kg"),
});

/* ── Lotes (dato maestro) ──────────────────────────────────── */

export const lotes = pgTable("lotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  fecha: date("fecha").notNull().defaultNow(),
  /** Un lote puede abarcar los dos productos. */
  productoId: uuid("producto_id").references(() => productos.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

/* ── Compras y bajas de insumos ────────────────────────────── */

export const comprasInsumo = pgTable("compras_insumo", {
  id: uuid("id").primaryKey().defaultRandom(),
  fecha: date("fecha").notNull().defaultNow(),
  proveedorId: uuid("proveedor_id").references(() => proveedores.id, {
    onDelete: "set null",
  }),
  loteId: uuid("lote_id").references(() => lotes.id, { onDelete: "set null" }),
  total: money("total"),
  /** Si es "credito", registra el saldo en la cuenta corriente del proveedor. */
  medioPago: medioPago("medio_pago").notNull().default("efectivo"),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const compraInsumoLineas = pgTable("compra_insumo_lineas", {
  id: uuid("id").primaryKey().defaultRandom(),
  compraId: uuid("compra_id")
    .notNull()
    .references(() => comprasInsumo.id, { onDelete: "cascade" }),
  insumoId: uuid("insumo_id")
    .notNull()
    .references(() => productos.id, { onDelete: "restrict" }),
  cantidad: qty("cantidad"),
  costoTotal: money("costo_total"),
  costoUnitario: money("costo_unitario"),
  vencimiento: date("vencimiento"),
});

export const bajasInsumo = pgTable("bajas_insumo", {
  id: uuid("id").primaryKey().defaultRandom(),
  fecha: date("fecha").notNull().defaultNow(),
  insumoId: uuid("insumo_id")
    .notNull()
    .references(() => productos.id, { onDelete: "restrict" }),
  cantidad: qty("cantidad"),
  motivo: motivoBaja("motivo").notNull(),
  monto: money("monto"), // cantidad × ppp al momento de la baja
  loteId: uuid("lote_id").references(() => lotes.id, { onDelete: "set null" }),
  /** Seteado si la baja fue automática al cerrar una orden (sobrante). */
  ordenId: uuid("orden_id").references((): AnyPgColumn => ordenesProduccion.id, {
    onDelete: "set null",
  }),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

/* ── Producción ────────────────────────────────────────────── */

export const preciosFabricacion = pgTable("precios_fabricacion", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** La fábrica cobra un monto por lote, sin importar unidades. */
  montoPorLote: money("monto_por_lote"),
  vigenteDesde: date("vigente_desde").notNull().defaultNow(),
  vigenteHasta: date("vigente_hasta"),
  ...timestamps,
});

export const ordenesProduccion = pgTable("ordenes_produccion", {
  id: uuid("id").primaryKey().defaultRandom(),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  recetaId: uuid("receta_id")
    .notNull()
    .references(() => recetas.id, { onDelete: "restrict" }),
  estado: estadoOrden("estado").notNull().default("planificada"),
  fechaPrevista: date("fecha_prevista").notNull().defaultNow(),
  fechaCierre: date("fecha_cierre"),
  unidadesPlanificadas: integer("unidades_planificadas").notNull(),
  unidadesObtenidas: integer("unidades_obtenidas"),
  fabricacionCotizada: money("fabricacion_cotizada"),
  fabricacionCobrada: numeric("fabricacion_cobrada", { precision: 14, scale: 2 }),
  costoMp: numeric("costo_mp", { precision: 14, scale: 2 }),
  costoTotal: numeric("costo_total", { precision: 14, scale: 2 }),
  costoUnitario: numeric("costo_unitario", { precision: 14, scale: 2 }),
  desvioMp: money("desvio_mp"),
  desvioFabricacion: money("desvio_fabricacion"),
  movimientoEntradaId: uuid("movimiento_entrada_id").references(
    (): AnyPgColumn => movimientos.id,
    { onDelete: "set null" },
  ),
  notas: text("notas"),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const ordenLineas = pgTable("orden_lineas", {
  id: uuid("id").primaryKey().defaultRandom(),
  ordenId: uuid("orden_id")
    .notNull()
    .references(() => ordenesProduccion.id, { onDelete: "cascade" }),
  insumoId: uuid("insumo_id")
    .notNull()
    .references(() => productos.id, { onDelete: "restrict" }),
  cantidadEstandar: qty("cantidad_estandar"),
  consumoTeorico: qty("consumo_teorico"),
  consumoReal: numeric("consumo_real", { precision: 14, scale: 4 }),
  pppAlCierre: numeric("ppp_al_cierre", { precision: 14, scale: 2 }),
  desvioFisico: qty("desvio_fisico"),
  desvioMonto: money("desvio_monto"),
});

/* ── Stock por lote (materializado, derivado de movimientos) ─ */

export const stockLotes = pgTable(
  "stock_lotes",
  {
    productoId: uuid("producto_id")
      .notNull()
      .references(() => productos.id, { onDelete: "cascade" }),
    loteId: uuid("lote_id")
      .notNull()
      .references(() => lotes.id, { onDelete: "cascade" }),
    unidadesEnDeposito: integer("unidades_en_deposito").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.productoId, t.loteId] }),
    check("stock_lotes_no_negativo", sql`${t.unidadesEnDeposito} >= 0`),
  ],
);

/* ── Movimientos ───────────────────────────────────────────── */

export const movimientos = pgTable("movimientos", {
  id: uuid("id").primaryKey().defaultRandom(),
  fecha: date("fecha").notNull().defaultNow(),
  tipo: tipoMovimiento("tipo").notNull(),
  clienteId: uuid("cliente_id").references(() => clientes.id, {
    onDelete: "set null",
  }),
  medioPago: medioPago("medio_pago"),
  observaciones: text("observaciones"),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const consignaciones = pgTable("consignaciones", {
  id: uuid("id").primaryKey().defaultRandom(),
  fecha: date("fecha").notNull().defaultNow(),
  vence: date("vence").notNull(),
  clienteId: uuid("cliente_id")
    .notNull()
    .references(() => clientes.id, { onDelete: "restrict" }),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id, { onDelete: "restrict" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  entregadas: integer("entregadas").notNull(),
  vendidas: integer("vendidas").notNull().default(0),
  devueltas: integer("devueltas").notNull().default(0),
  movimientoOrigenId: uuid("movimiento_origen_id").references(
    () => movimientos.id,
    { onDelete: "set null" },
  ),
  ...timestamps,
});

export const movimientoItems = pgTable("movimiento_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  movimientoId: uuid("movimiento_id")
    .notNull()
    .references(() => movimientos.id, { onDelete: "cascade" }),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id, { onDelete: "restrict" }),
  /** Puede ser negativa en ajuste. */
  cantidad: integer("cantidad").notNull(),
  precioConIva: numeric("precio_con_iva", { precision: 14, scale: 2 }),
  ingresoNeto: money("ingreso_neto"),
  costo: money("costo"),
  consignacionId: uuid("consignacion_id").references(() => consignaciones.id, {
    onDelete: "set null",
  }),
});

export const movimientoItemLotes = pgTable("movimiento_item_lotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => movimientoItems.id, { onDelete: "cascade" }),
  loteId: uuid("lote_id")
    .notNull()
    .references(() => lotes.id, { onDelete: "restrict" }),
  cantidad: integer("cantidad").notNull(),
});

/* ── Costos fijos (mensuales, versionados con vigencia) ────── */

export const costosFijos = pgTable("costos_fijos", {
  id: uuid("id").primaryKey().defaultRandom(),
  concepto: text("concepto").notNull(),
  categoria: categoriaCostoFijo("categoria").notNull().default("otros"),
  montoMensual: money("monto_mensual"),
  vigenteDesde: date("vigente_desde").notNull().defaultNow(),
  vigenteHasta: date("vigente_hasta"), // null = vigente
  notas: text("notas"),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

/* ── Lista de precios (retail / mayorista, versionada) ─────── */

export const preciosVenta = pgTable("precios_venta", {
  id: uuid("id").primaryKey().defaultRandom(),
  productoId: uuid("producto_id")
    .notNull()
    .references(() => productos.id, { onDelete: "cascade" }),
  tipoLista: tipoListaPrecio("tipo_lista").notNull().default("retail"),
  precioConIva: money("precio_con_iva"),
  vigenteDesde: date("vigente_desde").notNull().defaultNow(),
  vigenteHasta: date("vigente_hasta"), // null = vigente
  ...timestamps,
});

/* ── Cuenta corriente (clientes y proveedores) ─────────────── */

/**
 * Ledger por tercero (`entidad_tipo` + `entidad_id`, sin FK física — puede
 * apuntar a `clientes.id` o `proveedores.id`). Convención (D-14 extendida):
 * cliente → saldo = Σdebe − Σhaber (positivo = nos debe); proveedor →
 * saldo = Σhaber − Σdebe (positivo = les debemos).
 */
export const ccMovimientos = pgTable("cc_movimientos", {
  id: uuid("id").primaryKey().defaultRandom(),
  entidadTipo: entidadCc("entidad_tipo").notNull(),
  entidadId: uuid("entidad_id").notNull(),
  fecha: date("fecha").notNull().defaultNow(),
  concepto: text("concepto").notNull(),
  debe: money("debe"),
  haber: money("haber"),
  origen: origenCc("origen").notNull().default("ajuste"),
  medioPago: medioPago("medio_pago"),
  movimientoId: uuid("movimiento_id").references(() => movimientos.id, {
    onDelete: "set null",
  }),
  compraId: uuid("compra_id").references(() => comprasInsumo.id, {
    onDelete: "set null",
  }),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

/* ── Contabilidad (Fase 2, dormida en Fase 4) ──────────────── */

export const planCuentas = pgTable("plan_cuentas", {
  id: uuid("id").primaryKey().defaultRandom(),
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
  rubro: text("rubro").notNull(),
  tipo: tipoCuenta("tipo").notNull(),
  activo: boolean("activo").notNull().default(true),
  ...timestamps,
});

export const asientos = pgTable("asientos", {
  id: uuid("id").primaryKey().defaultRandom(),
  fecha: date("fecha").notNull().defaultNow(),
  descripcion: text("descripcion").notNull(),
  origen: text("origen").notNull().default("manual"),
  estado: text("estado").notNull().default("confirmado"),
  creadoPor: uuid("creado_por").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  ...timestamps,
});

export const asientoLineas = pgTable("asiento_lineas", {
  id: uuid("id").primaryKey().defaultRandom(),
  asientoId: uuid("asiento_id")
    .notNull()
    .references(() => asientos.id, { onDelete: "cascade" }),
  cuentaId: uuid("cuenta_id")
    .notNull()
    .references(() => planCuentas.id, { onDelete: "restrict" }),
  debe: money("debe"),
  haber: money("haber"),
  concepto: text("concepto"),
  ...timestamps,
});

/* ── Auditoría ─────────────────────────────────────────────── */

export const auditoria = pgTable("auditoria", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => perfiles.id, {
    onDelete: "set null",
  }),
  accion: text("accion").notNull(),
  entidad: text("entidad").notNull(),
  entidadId: uuid("entidad_id"),
  datos: text("datos"),
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
  proveedorHabitual: one(proveedores, {
    fields: [productos.proveedorHabitualId],
    references: [proveedores.id],
  }),
  recetas: many(recetas),
  stockLotes: many(stockLotes),
  preciosVenta: many(preciosVenta),
}));

export const preciosVentaRelations = relations(preciosVenta, ({ one }) => ({
  producto: one(productos, {
    fields: [preciosVenta.productoId],
    references: [productos.id],
  }),
}));

export const ccMovimientosRelations = relations(ccMovimientos, ({ one }) => ({
  movimiento: one(movimientos, {
    fields: [ccMovimientos.movimientoId],
    references: [movimientos.id],
  }),
  compra: one(comprasInsumo, {
    fields: [ccMovimientos.compraId],
    references: [comprasInsumo.id],
  }),
}));

export const recetasRelations = relations(recetas, ({ one, many }) => ({
  producto: one(productos, {
    fields: [recetas.productoId],
    references: [productos.id],
  }),
  lineas: many(recetaLineas),
}));

export const recetaLineasRelations = relations(recetaLineas, ({ one }) => ({
  receta: one(recetas, {
    fields: [recetaLineas.recetaId],
    references: [recetas.id],
  }),
  insumo: one(productos, {
    fields: [recetaLineas.insumoId],
    references: [productos.id],
  }),
}));

export const lotesRelations = relations(lotes, ({ one, many }) => ({
  producto: one(productos, {
    fields: [lotes.productoId],
    references: [productos.id],
  }),
  stockLotes: many(stockLotes),
}));

export const comprasInsumoRelations = relations(
  comprasInsumo,
  ({ one, many }) => ({
    proveedor: one(proveedores, {
      fields: [comprasInsumo.proveedorId],
      references: [proveedores.id],
    }),
    lote: one(lotes, {
      fields: [comprasInsumo.loteId],
      references: [lotes.id],
    }),
    lineas: many(compraInsumoLineas),
  }),
);

export const compraInsumoLineasRelations = relations(
  compraInsumoLineas,
  ({ one }) => ({
    compra: one(comprasInsumo, {
      fields: [compraInsumoLineas.compraId],
      references: [comprasInsumo.id],
    }),
    insumo: one(productos, {
      fields: [compraInsumoLineas.insumoId],
      references: [productos.id],
    }),
  }),
);

export const bajasInsumoRelations = relations(bajasInsumo, ({ one }) => ({
  insumo: one(productos, {
    fields: [bajasInsumo.insumoId],
    references: [productos.id],
  }),
  lote: one(lotes, { fields: [bajasInsumo.loteId], references: [lotes.id] }),
  orden: one(ordenesProduccion, {
    fields: [bajasInsumo.ordenId],
    references: [ordenesProduccion.id],
  }),
}));

export const ordenesProduccionRelations = relations(
  ordenesProduccion,
  ({ one, many }) => ({
    producto: one(productos, {
      fields: [ordenesProduccion.productoId],
      references: [productos.id],
    }),
    lote: one(lotes, {
      fields: [ordenesProduccion.loteId],
      references: [lotes.id],
    }),
    receta: one(recetas, {
      fields: [ordenesProduccion.recetaId],
      references: [recetas.id],
    }),
    movimientoEntrada: one(movimientos, {
      fields: [ordenesProduccion.movimientoEntradaId],
      references: [movimientos.id],
    }),
    lineas: many(ordenLineas),
  }),
);

export const ordenLineasRelations = relations(ordenLineas, ({ one }) => ({
  orden: one(ordenesProduccion, {
    fields: [ordenLineas.ordenId],
    references: [ordenesProduccion.id],
  }),
  insumo: one(productos, {
    fields: [ordenLineas.insumoId],
    references: [productos.id],
  }),
}));

export const stockLotesRelations = relations(stockLotes, ({ one }) => ({
  producto: one(productos, {
    fields: [stockLotes.productoId],
    references: [productos.id],
  }),
  lote: one(lotes, {
    fields: [stockLotes.loteId],
    references: [lotes.id],
  }),
}));

export const movimientosRelations = relations(movimientos, ({ one, many }) => ({
  cliente: one(clientes, {
    fields: [movimientos.clienteId],
    references: [clientes.id],
  }),
  creador: one(perfiles, {
    fields: [movimientos.creadoPor],
    references: [perfiles.id],
  }),
  items: many(movimientoItems),
}));

export const movimientoItemsRelations = relations(
  movimientoItems,
  ({ one, many }) => ({
    movimiento: one(movimientos, {
      fields: [movimientoItems.movimientoId],
      references: [movimientos.id],
    }),
    producto: one(productos, {
      fields: [movimientoItems.productoId],
      references: [productos.id],
    }),
    consignacion: one(consignaciones, {
      fields: [movimientoItems.consignacionId],
      references: [consignaciones.id],
    }),
    lotes: many(movimientoItemLotes),
  }),
);

export const movimientoItemLotesRelations = relations(
  movimientoItemLotes,
  ({ one }) => ({
    item: one(movimientoItems, {
      fields: [movimientoItemLotes.itemId],
      references: [movimientoItems.id],
    }),
    lote: one(lotes, {
      fields: [movimientoItemLotes.loteId],
      references: [lotes.id],
    }),
  }),
);

export const consignacionesRelations = relations(
  consignaciones,
  ({ one }) => ({
    cliente: one(clientes, {
      fields: [consignaciones.clienteId],
      references: [clientes.id],
    }),
    producto: one(productos, {
      fields: [consignaciones.productoId],
      references: [productos.id],
    }),
    lote: one(lotes, {
      fields: [consignaciones.loteId],
      references: [lotes.id],
    }),
    movimientoOrigen: one(movimientos, {
      fields: [consignaciones.movimientoOrigenId],
      references: [movimientos.id],
    }),
  }),
);

export const asientosRelations = relations(asientos, ({ one, many }) => ({
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
