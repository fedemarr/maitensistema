CREATE TYPE "public"."cc_entidad_tipo" AS ENUM('cliente', 'proveedor');--> statement-breakpoint
CREATE TYPE "public"."estado_consignacion" AS ENUM('pendiente', 'vendido', 'devuelto');--> statement-breakpoint
CREATE TABLE "cc_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entidad_tipo" "cc_entidad_tipo" NOT NULL,
	"entidad_id" uuid NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"debe" numeric(12, 2) DEFAULT '0' NOT NULL,
	"haber" numeric(12, 2) DEFAULT '0' NOT NULL,
	"concepto" text,
	"movimiento_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consignaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movimiento_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"vence_el" date NOT NULL,
	"estado" "estado_consignacion" DEFAULT 'pendiente' NOT NULL,
	"cierre_movimiento_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cc_movimientos" ADD CONSTRAINT "cc_movimientos_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignaciones" ADD CONSTRAINT "consignaciones_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignaciones" ADD CONSTRAINT "consignaciones_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignaciones" ADD CONSTRAINT "consignaciones_cierre_movimiento_id_movimientos_id_fk" FOREIGN KEY ("cierre_movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE set null ON UPDATE no action;