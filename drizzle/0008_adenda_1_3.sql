ALTER TABLE "movimientos" ADD COLUMN "estado" text DEFAULT 'vigente' NOT NULL;--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "cliente_snapshot" text;--> statement-breakpoint
ALTER TABLE "facturas" DROP CONSTRAINT "facturas_movimiento_id_unique";--> statement-breakpoint
ALTER TABLE "facturas" ALTER COLUMN "cae" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ALTER COLUMN "cae_vencimiento" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "comprobante_asociado_id" uuid;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "origen" text DEFAULT 'sistema' NOT NULL;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "motivo" text;--> statement-breakpoint
ALTER TABLE "facturas" ADD COLUMN "enviado_a" text;--> statement-breakpoint
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_comprobante_asociado_id_facturas_id_fk" FOREIGN KEY ("comprobante_asociado_id") REFERENCES "public"."facturas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "plan_cuentas" ("codigo", "nombre", "rubro", "tipo") VALUES
  ('2.1.2', 'IVA Débito Fiscal', 'Pasivo Corriente', 'pasivo')
ON CONFLICT ("codigo") DO NOTHING;
