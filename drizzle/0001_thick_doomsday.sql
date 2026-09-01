ALTER TYPE "public"."tipo_movimiento" ADD VALUE 'ajuste';--> statement-breakpoint
CREATE TABLE "medios_pago" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"es_credito" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medios_pago_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "medio_pago_id" uuid;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_medio_pago_id_medios_pago_id_fk" FOREIGN KEY ("medio_pago_id") REFERENCES "public"."medios_pago"("id") ON DELETE set null ON UPDATE no action;