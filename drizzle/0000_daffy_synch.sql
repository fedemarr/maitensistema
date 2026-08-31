CREATE TYPE "public"."rol_usuario" AS ENUM('admin', 'ventas', 'lectura');--> statement-breakpoint
CREATE TYPE "public"."tipo_cliente" AS ENUM('veterinaria', 'peluqueria', 'influencer', 'mayorista', 'particular');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('ingreso', 'venta', 'consignacion', 'canje', 'presentacion', 'regalo', 'rotura', 'devolucion_consignacion');--> statement-breakpoint
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
CREATE TABLE "movimiento_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movimiento_id" uuid NOT NULL,
	"variante_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"costo_unit" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"cliente_id" uuid,
	"proveedor_id" uuid,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
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
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"nombre" text NOT NULL,
	"rubro_id" uuid,
	"precio_lista" numeric(12, 2) DEFAULT '0' NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"foto_path" text,
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
CREATE TABLE "rubros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rubros_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "variantes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"presentacion" text,
	"fragancia" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"stock_min" integer DEFAULT 0 NOT NULL,
	"costo_promedio" numeric(12, 2) DEFAULT '0' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_id_perfiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_items" ADD CONSTRAINT "movimiento_items_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento_items" ADD CONSTRAINT "movimiento_items_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_rubro_id_rubros_id_fk" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variantes" ADD CONSTRAINT "variantes_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;