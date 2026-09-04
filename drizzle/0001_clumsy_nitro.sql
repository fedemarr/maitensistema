CREATE TYPE "public"."categoria_costo_fijo" AS ENUM('alquiler', 'sueldos', 'servicios', 'impuestos', 'marketing', 'seguros', 'otros');--> statement-breakpoint
CREATE TYPE "public"."tipo_lista_precio" AS ENUM('retail', 'mayorista');--> statement-breakpoint
CREATE TABLE "costos_fijos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concepto" text NOT NULL,
	"categoria" "categoria_costo_fijo" DEFAULT 'otros' NOT NULL,
	"monto_mensual" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vigente_desde" date DEFAULT now() NOT NULL,
	"vigente_hasta" date,
	"notas" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precios_venta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"producto_id" uuid NOT NULL,
	"tipo_lista" "tipo_lista_precio" DEFAULT 'retail' NOT NULL,
	"precio_con_iva" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vigente_desde" date DEFAULT now() NOT NULL,
	"vigente_hasta" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "costos_fijos" ADD CONSTRAINT "costos_fijos_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precios_venta" ADD CONSTRAINT "precios_venta_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;