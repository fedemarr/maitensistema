CREATE TYPE "public"."estado_orden_produccion" AS ENUM('planificada', 'cerrada', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."medio_pago" AS ENUM('efectivo', 'transferencia', 'mercado_pago', 'tienda_nube', 'credito');--> statement-breakpoint
CREATE TYPE "public"."motivo_baja_insumo" AS ENUM('vencido', 'secado', 'no_reutilizable', 'rotura', 'ajuste_inventario');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('admin', 'ventas', 'lectura');--> statement-breakpoint
CREATE TYPE "public"."tipo_cliente" AS ENUM('particular', 'veterinaria', 'pet_shop', 'distribuidor', 'marca_aliada', 'prensa_influencer');--> statement-breakpoint
CREATE TYPE "public"."tipo_cuenta" AS ENUM('activo', 'pasivo', 'pn', 'rpos', 'rneg');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('venta', 'venta_consignacion', 'consignacion', 'devolucion_consignacion', 'canje', 'presentacion', 'regalo', 'rotura', 'sorteo', 'tester', 'co_branding', 'influencer', 'prueba', 'ajuste', 'produccion');--> statement-breakpoint
CREATE TYPE "public"."unidad_insumo" AS ENUM('kg', 'u');--> statement-breakpoint
CREATE TABLE "asiento_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asiento_id" uuid NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"debe" numeric(14, 2) DEFAULT '0' NOT NULL,
	"haber" numeric(14, 2) DEFAULT '0' NOT NULL,
	"concepto" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"descripcion" text NOT NULL,
	"origen" text DEFAULT 'manual' NOT NULL,
	"estado" text DEFAULT 'confirmado' NOT NULL,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" uuid,
	"datos" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bajas_insumo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"insumo_id" uuid NOT NULL,
	"cantidad" numeric(14, 4) DEFAULT '0' NOT NULL,
	"motivo" "motivo_baja_insumo" NOT NULL,
	"monto" numeric(14, 2) DEFAULT '0' NOT NULL,
	"lote_id" uuid,
	"orden_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_cliente" DEFAULT 'particular' NOT NULL,
	"email" text,
	"telefono" text,
	"cuit" text,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compra_insumo_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compra_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"cantidad" numeric(14, 4) DEFAULT '0' NOT NULL,
	"costo_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"costo_unitario" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vencimiento" date
);
--> statement-breakpoint
CREATE TABLE "compras_insumo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"proveedor_id" uuid,
	"lote_id" uuid,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consignaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"vence" date NOT NULL,
	"cliente_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"lote_id" uuid NOT NULL,
	"entregadas" integer NOT NULL,
	"vendidas" integer DEFAULT 0 NOT NULL,
	"devueltas" integer DEFAULT 0 NOT NULL,
	"movimiento_origen_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"producto_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lotes_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "movimiento_item_lotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"lote_id" uuid NOT NULL,
	"cantidad" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimiento_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movimiento_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_con_iva" numeric(14, 2),
	"ingreso_neto" numeric(14, 2) DEFAULT '0' NOT NULL,
	"costo" numeric(14, 2) DEFAULT '0' NOT NULL,
	"consignacion_id" uuid
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"cliente_id" uuid,
	"medio_pago" "medio_pago",
	"observaciones" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orden_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orden_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"cantidad_estandar" numeric(14, 4) DEFAULT '0' NOT NULL,
	"consumo_teorico" numeric(14, 4) DEFAULT '0' NOT NULL,
	"consumo_real" numeric(14, 4),
	"ppp_al_cierre" numeric(14, 2),
	"desvio_fisico" numeric(14, 4) DEFAULT '0' NOT NULL,
	"desvio_monto" numeric(14, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordenes_produccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"lote_id" uuid NOT NULL,
	"receta_id" uuid NOT NULL,
	"estado" "estado_orden_produccion" DEFAULT 'planificada' NOT NULL,
	"fecha_prevista" date DEFAULT now() NOT NULL,
	"fecha_cierre" date,
	"unidades_planificadas" integer NOT NULL,
	"unidades_obtenidas" integer,
	"fabricacion_cotizada" numeric(14, 2) DEFAULT '0' NOT NULL,
	"fabricacion_cobrada" numeric(14, 2),
	"costo_mp" numeric(14, 2),
	"costo_total" numeric(14, 2),
	"costo_unitario" numeric(14, 2),
	"desvio_mp" numeric(14, 2) DEFAULT '0' NOT NULL,
	"desvio_fabricacion" numeric(14, 2) DEFAULT '0' NOT NULL,
	"movimiento_entrada_id" uuid,
	"notas" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perfiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"rol" "rol_usuario" DEFAULT 'lectura' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_cuentas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"rubro" text NOT NULL,
	"tipo" "tipo_cuenta" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_cuentas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "precios_fabricacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monto_por_lote" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vigente_desde" date DEFAULT now() NOT NULL,
	"vigente_hasta" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"nombre" text NOT NULL,
	"rubro_id" uuid,
	"presentacion" text,
	"stock_minimo" integer DEFAULT 0 NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"es_insumo" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ppp" numeric(14, 2) DEFAULT '0' NOT NULL,
	"foto_path" text,
	"reutilizable" boolean DEFAULT false NOT NULL,
	"vence" boolean DEFAULT false NOT NULL,
	"unidad" "unidad_insumo",
	"proveedor_habitual_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"cuit" text,
	"email" text,
	"telefono" text,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receta_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receta_id" uuid NOT NULL,
	"insumo_id" uuid NOT NULL,
	"cantidad_por_unidad" numeric(14, 4) DEFAULT '0' NOT NULL,
	"unidad" "unidad_insumo" DEFAULT 'kg' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recetas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"numero" integer DEFAULT 1 NOT NULL,
	"vigente_desde" date DEFAULT now() NOT NULL,
	"vigente_hasta" date,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rubros_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "stock_lotes" (
	"producto_id" uuid NOT NULL,
	"lote_id" uuid NOT NULL,
	"unidades_en_deposito" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_lotes_producto_id_lote_id_pk" PRIMARY KEY("producto_id","lote_id"),
	CONSTRAINT "stock_lotes_no_negativo" CHECK ("stock_lotes"."unidades_en_deposito" >= 0)
);
--> statement-breakpoint
ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_asiento_id_asientos_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_id_perfiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bajas_insumo" ADD CONSTRAINT "bajas_insumo_insumo_id_productos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bajas_insumo" ADD CONSTRAINT "bajas_insumo_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bajas_insumo" ADD CONSTRAINT "bajas_insumo_orden_id_ordenes_produccion_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_produccion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bajas_insumo" ADD CONSTRAINT "bajas_insumo_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra_insumo_lineas" ADD CONSTRAINT "compra_insumo_lineas_compra_id_compras_insumo_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras_insumo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra_insumo_lineas" ADD CONSTRAINT "compra_insumo_lineas_insumo_id_productos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD CONSTRAINT "compras_insumo_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD CONSTRAINT "compras_insumo_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD CONSTRAINT "compras_insumo_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignaciones" ADD CONSTRAINT "consignaciones_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignaciones" ADD CONSTRAINT "consignaciones_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignaciones" ADD CONSTRAINT "consignaciones_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignaciones" ADD CONSTRAINT "consignaciones_movimiento_origen_id_movimientos_id_fk" FOREIGN KEY ("movimiento_origen_id") REFERENCES "public"."movimientos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lotes" ADD CONSTRAINT "lotes_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_item_lotes" ADD CONSTRAINT "movimiento_item_lotes_item_id_movimiento_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."movimiento_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_item_lotes" ADD CONSTRAINT "movimiento_item_lotes_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_items" ADD CONSTRAINT "movimiento_items_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_items" ADD CONSTRAINT "movimiento_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_items" ADD CONSTRAINT "movimiento_items_consignacion_id_consignaciones_id_fk" FOREIGN KEY ("consignacion_id") REFERENCES "public"."consignaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_lineas" ADD CONSTRAINT "orden_lineas_orden_id_ordenes_produccion_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_produccion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orden_lineas" ADD CONSTRAINT "orden_lineas_insumo_id_productos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_movimiento_entrada_id_movimientos_id_fk" FOREIGN KEY ("movimiento_entrada_id") REFERENCES "public"."movimientos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_rubro_id_rubros_id_fk" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_proveedor_habitual_id_proveedores_id_fk" FOREIGN KEY ("proveedor_habitual_id") REFERENCES "public"."proveedores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_lineas" ADD CONSTRAINT "receta_lineas_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_lineas" ADD CONSTRAINT "receta_lineas_insumo_id_productos_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lotes" ADD CONSTRAINT "stock_lotes_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lotes" ADD CONSTRAINT "stock_lotes_lote_id_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE cascade ON UPDATE no action;