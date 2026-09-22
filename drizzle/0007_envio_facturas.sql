ALTER TABLE "facturas" ADD COLUMN "enviada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "enviada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "envio_error" text;
