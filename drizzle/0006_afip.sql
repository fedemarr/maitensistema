CREATE TYPE "public"."condicion_iva_cliente" AS ENUM('responsable_inscripto', 'monotributo', 'exento', 'consumidor_final');--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "condicion_iva" "condicion_iva_cliente" DEFAULT 'consumidor_final' NOT NULL;--> statement-breakpoint
CREATE TABLE "facturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movimiento_id" uuid NOT NULL,
	"punto_venta" integer NOT NULL,
	"tipo_comprobante" text NOT NULL,
	"codigo_comprobante" integer NOT NULL,
	"numero" integer NOT NULL,
	"cae" text NOT NULL,
	"cae_vencimiento" date NOT NULL,
	"doc_tipo" integer NOT NULL,
	"doc_nro" text NOT NULL,
	"importe_neto" numeric(14, 2) DEFAULT '0' NOT NULL,
	"importe_iva" numeric(14, 2) DEFAULT '0' NOT NULL,
	"importe_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"emitido_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facturas_movimiento_id_unique" UNIQUE("movimiento_id")
);
--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_emitido_por_perfiles_id_fk" FOREIGN KEY ("emitido_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;
