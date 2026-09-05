-- v1.2: IVA (precios netos) + tarifario de la fábrica por producto con vigencias
-- (spec funcional Maitén v1.2, §1.5 y §3.3).

-- ── Precios de venta: el valor guardado pasa a ser NETO ──
ALTER TABLE "precios_venta" RENAME COLUMN "precio_con_iva" TO "precio_neto";
--> statement-breakpoint

-- ── Ítems de movimiento: el precio guardado pasa a ser NETO ──
ALTER TABLE "movimiento_items" RENAME COLUMN "precio_con_iva" TO "precio_neto";
--> statement-breakpoint

-- ── Tarifario de fabricación: de "monto por lote" a "precio por unidad y producto" ──
DELETE FROM "precios_fabricacion";
--> statement-breakpoint
ALTER TABLE "precios_fabricacion" DROP COLUMN "monto_por_lote";
--> statement-breakpoint
ALTER TABLE "precios_fabricacion" ADD COLUMN "producto_id" uuid NOT NULL REFERENCES "productos"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "precios_fabricacion" ADD COLUMN "precio_unitario" numeric(14, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "precios_fabricacion" ADD COLUMN "creado_por" uuid REFERENCES "perfiles"("id") ON DELETE set null;
--> statement-breakpoint

-- ── Mínimo de compra por orden que exige la fábrica (una fila por vigencia) ──
CREATE TABLE "minimo_compra_fabrica" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "monto" numeric(14, 2) DEFAULT '0' NOT NULL,
  "vigente_desde" date DEFAULT now() NOT NULL,
  "vigente_hasta" date,
  "creado_por" uuid REFERENCES "perfiles"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ── Órdenes: se congela el precio unitario y el mínimo vigentes a la fecha ──
ALTER TABLE "ordenes_produccion" ADD COLUMN "precio_fabricacion_unitario" numeric(14, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD COLUMN "minimo_compra_aplicado" numeric(14, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD COLUMN "minimo_compra_id" uuid REFERENCES "minimo_compra_fabrica"("id") ON DELETE set null;
--> statement-breakpoint

-- ── Seed: tarifario de la fábrica (OC N°3, sin IVA) + mínimo $450.000 ──
INSERT INTO "precios_fabricacion" ("producto_id", "precio_unitario", "vigente_desde", "vigente_hasta")
SELECT p.id, v.precio, v.desde::date, v.hasta::date
FROM "productos" p
JOIN (VALUES
  ('MAI-SH-AR-250', 960.00,   '2026-01-01', '2026-06-30'),
  ('MAI-SH-AR-250', 1092.00,  '2026-07-01', NULL),
  ('MAI-CR-CAL-060', 1200.00, '2026-01-01', '2026-06-30'),
  ('MAI-CR-CAL-060', 1460.36, '2026-07-01', NULL)
) AS v(sku, precio, desde, hasta) ON p.sku = v.sku;
--> statement-breakpoint
INSERT INTO "minimo_compra_fabrica" ("monto", "vigente_desde")
VALUES (450000.00, '2026-01-01');
