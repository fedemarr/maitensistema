ALTER TABLE "asientos" ADD COLUMN "movimiento_id" uuid;--> statement-breakpoint
ALTER TABLE "asientos" ADD COLUMN "compra_id" uuid;--> statement-breakpoint
ALTER TABLE "asientos" ADD COLUMN "orden_id" uuid;--> statement-breakpoint
ALTER TABLE "asientos" ADD COLUMN "cc_movimiento_id" uuid;--> statement-breakpoint
ALTER TABLE "asientos" ADD COLUMN "baja_id" uuid;--> statement-breakpoint
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_compra_id_compras_insumo_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras_insumo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_orden_id_ordenes_produccion_id_fk" FOREIGN KEY ("orden_id") REFERENCES "public"."ordenes_produccion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_cc_movimiento_id_cc_movimientos_id_fk" FOREIGN KEY ("cc_movimiento_id") REFERENCES "public"."cc_movimientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_baja_id_bajas_insumo_id_fk" FOREIGN KEY ("baja_id") REFERENCES "public"."bajas_insumo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "plan_cuentas" ("codigo", "nombre", "rubro", "tipo") VALUES
  ('1.1.1', 'Caja', 'Activo Corriente', 'activo'),
  ('1.1.2', 'Banco', 'Activo Corriente', 'activo'),
  ('1.1.3', 'Mercadería', 'Activo Corriente', 'activo'),
  ('1.1.4', 'Deudores por ventas', 'Activo Corriente', 'activo'),
  ('1.1.5', 'Mercadería en consignación', 'Activo Corriente', 'activo'),
  ('2.1.1', 'Proveedores a pagar', 'Pasivo Corriente', 'pasivo'),
  ('3.1.1', 'Capital inicial', 'Patrimonio Neto', 'pn'),
  ('4.1.1', 'Ventas - Maitén', 'Resultado Positivo', 'rpos'),
  ('5.1.1', 'CMV', 'Resultado Negativo', 'rneg'),
  ('5.1.2', 'Gastos operativos', 'Resultado Negativo', 'rneg'),
  ('5.1.3', 'Fabricación', 'Resultado Negativo', 'rneg'),
  ('5.1.4', 'Pérdida por insumos', 'Resultado Negativo', 'rneg')
ON CONFLICT ("codigo") DO NOTHING;
