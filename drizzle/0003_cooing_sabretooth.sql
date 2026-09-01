CREATE TYPE "public"."tipo_cuenta" AS ENUM('activo', 'pasivo', 'pn', 'rpos', 'rneg');--> statement-breakpoint
CREATE TABLE "asiento_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asiento_id" uuid NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"debe" numeric(12, 2) DEFAULT '0' NOT NULL,
	"haber" numeric(12, 2) DEFAULT '0' NOT NULL,
	"concepto" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fecha" date DEFAULT now() NOT NULL,
	"descripcion" text NOT NULL,
	"origen" text NOT NULL,
	"estado" text DEFAULT 'confirmado' NOT NULL,
	"movimiento_id" uuid,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_cuentas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"rubro" text NOT NULL,
	"tipo" "tipo_cuenta" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_cuentas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
ALTER TABLE "medios_pago" ADD COLUMN "cuenta_id" uuid;--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "consignacion_id" uuid;--> statement-breakpoint
ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_asiento_id_asientos_id_fk" FOREIGN KEY ("asiento_id") REFERENCES "public"."asientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_movimiento_id_movimientos_id_fk" FOREIGN KEY ("movimiento_id") REFERENCES "public"."movimientos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medios_pago" ADD CONSTRAINT "medios_pago_cuenta_id_plan_cuentas_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."plan_cuentas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "public"."plan_cuentas" ("codigo","nombre","rubro","tipo") VALUES
	('1.1.1','Caja','Activo Corriente','activo'),
	('1.1.2','Banco','Activo Corriente','activo'),
	('1.1.3','Mercadería','Activo Corriente','activo'),
	('1.1.4','Deudores por ventas','Activo Corriente','activo'),
	('1.1.5','Mercadería en consignación','Activo Corriente','activo'),
	('1.2.1','Mobiliario y equipos','Activo Fijo','activo'),
	('2.1.1','Proveedores a pagar','Pasivo Corriente','pasivo'),
	('2.1.2','Deuda con consignatarios','Pasivo Corriente','pasivo'),
	('3.1.1','Capital inicial','Patrimonio Neto','pn'),
	('3.1.2','Resultados acumulados','Patrimonio Neto','pn'),
	('4.1.1','Ventas - Maitén','Resultado Positivo','rpos'),
	('5.1.1','CMV','Resultado Negativo','rneg'),
	('5.1.2','Gastos operativos','Resultado Negativo','rneg'),
	('5.1.3','Materia prima','Resultado Negativo','rneg'),
	('5.1.4','Packaging','Resultado Negativo','rneg')
ON CONFLICT ("codigo") DO NOTHING;--> statement-breakpoint
UPDATE "public"."medios_pago" SET "cuenta_id" = (
	SELECT p."id" FROM "public"."plan_cuentas" p
	WHERE p."codigo" = CASE
		WHEN "medios_pago"."nombre" IN ('Transferencia','Mercado Pago') THEN '1.1.2'
		WHEN "medios_pago"."nombre" = 'Efectivo' THEN '1.1.1'
		ELSE NULL END
) WHERE "cuenta_id" IS NULL;