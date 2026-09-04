CREATE TYPE "public"."entidad_cc" AS ENUM('cliente', 'proveedor');--> statement-breakpoint
CREATE TYPE "public"."origen_cc" AS ENUM('venta_credito', 'compra_credito', 'cobro', 'pago', 'ajuste');--> statement-breakpoint
CREATE TABLE "cc_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entidad_tipo" "entidad_cc" NOT NULL,
	"entidad_id" uuid NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"concepto" text NOT NULL,
	"debe" numeric(14, 2) DEFAULT '0' NOT NULL,
	"haber" numeric(14, 2) DEFAULT '0' NOT NULL,
	"origen" "origen_cc" DEFAULT 'ajuste' NOT NULL,
	"medio_pago" "medio_pago",
	"movimiento_id" uuid,
	"compra_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD COLUMN "medio_pago" "medio_pago" DEFAULT 'efectivo' NOT NULL;--> statement-breakpoint
ALTER TABLE "cc_movimientos" ADD CONSTRAINT "cc_movimientos_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cc_movimientos" ADD CONSTRAINT "cc_movimientos_compra_id_compras_insumo_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras_insumo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cc_movimientos" ADD CONSTRAINT "cc_movimientos_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;