CREATE TABLE "integraciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proveedor" text NOT NULL,
	"store_id" text,
	"access_token" text,
	"scope" text,
	"estado" text DEFAULT 'desconectado' NOT NULL,
	"ultimo_sync" timestamp with time zone,
	"datos" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integraciones_proveedor_unique" UNIQUE("proveedor")
);
--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "origen" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "origen_externo" text;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_origen_externo_unique" UNIQUE("origen_externo");--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "tiendanube_product_id" text;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "tiendanube_variant_id" text;
