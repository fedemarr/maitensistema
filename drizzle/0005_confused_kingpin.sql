CREATE TYPE "public"."estado_orden_produccion" AS ENUM('borrador', 'en_proceso', 'completada', 'anulada');--> statement-breakpoint
ALTER TYPE "public"."tipo_movimiento" ADD VALUE 'produccion';--> statement-breakpoint
CREATE TABLE "ordenes_produccion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variante_terminado_id" uuid NOT NULL,
	"cantidad" integer NOT NULL,
	"estado" "estado_orden_produccion" DEFAULT 'borrador' NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"movimiento_id" uuid,
	"notas" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receta_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receta_id" uuid NOT NULL,
	"variante_insumo_id" uuid NOT NULL,
	"cantidad" numeric(14, 4) NOT NULL,
	"merma_pct" numeric(5, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recetas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variante_terminado_id" uuid NOT NULL,
	"rinde" integer DEFAULT 1 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "es_insumo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_variante_terminado_id_variantes_id_fk" FOREIGN KEY ("variante_terminado_id") REFERENCES "public"."variantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_items" ADD CONSTRAINT "receta_items_receta_id_recetas_id_fk" FOREIGN KEY ("receta_id") REFERENCES "public"."recetas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receta_items" ADD CONSTRAINT "receta_items_variante_insumo_id_variantes_id_fk" FOREIGN KEY ("variante_insumo_id") REFERENCES "public"."variantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_variante_terminado_id_variantes_id_fk" FOREIGN KEY ("variante_terminado_id") REFERENCES "public"."variantes"("id") ON DELETE cascade ON UPDATE no action;