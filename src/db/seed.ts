/**
 * Datos de ejemplo para desarrollo.
 *   pnpm db:seed
 * Idempotente: usa onConflictDoNothing sobre claves naturales (nombre / sku).
 * No toca `perfiles` ni `auth.users` (eso se maneja desde Supabase).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está seteada. Corré con: pnpm db:seed");
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });
const db = drizzle(client, { schema, casing: "snake_case" });

async function main() {
  const { rubros, productos, variantes, mediosPago, planCuentas } = schema;

  await db
    .insert(rubros)
    .values([{ nombre: "Capilar" }, { nombre: "Corporal" }])
    .onConflictDoNothing();

  const cuentaPorCodigo = async (codigo: string) =>
    (
      await db.query.planCuentas.findFirst({
        where: eq(planCuentas.codigo, codigo),
        columns: { id: true },
      })
    )?.id ?? null;

  const cuentas = await Promise.all([
    cuentaPorCodigo("1.1.1"),
    cuentaPorCodigo("1.1.2"),
  ]);
  const [caja, banco] = cuentas;

  const medios = [
    { nombre: "Efectivo", esCredito: false, cuentaId: caja },
    { nombre: "Transferencia", esCredito: false, cuentaId: banco },
    { nombre: "Mercado Pago", esCredito: false, cuentaId: banco },
    { nombre: "Crédito", esCredito: true, cuentaId: null },
  ];

  await Promise.all(
    medios.map((m) =>
      db
        .insert(mediosPago)
        .values(m)
        .onConflictDoUpdate({
          target: mediosPago.nombre,
          set: { esCredito: m.esCredito, cuentaId: m.cuentaId },
        }),
    ),
  );

  const capilar = await db.query.rubros.findFirst({
    where: eq(rubros.nombre, "Capilar"),
  });
  const corporal = await db.query.rubros.findFirst({
    where: eq(rubros.nombre, "Corporal"),
  });

  const seedProductos = [
    {
      sku: "MAI-SH-AR-250",
      nombre: "Shampoo Aloe Vera y Rosa Mosqueta",
      rubroId: capilar?.id ?? null,
      online: true,
      variante: { nombre: "250 ml", presentacion: "250 ml", stockMin: 50 },
    },
    {
      sku: "MAI-CR-CAL-060",
      nombre: "Crema Reparadora de Caléndula",
      rubroId: corporal?.id ?? null,
      online: true,
      variante: { nombre: "60 g", presentacion: "60 g", stockMin: 50 },
    },
  ];

  for (const p of seedProductos) {
    const [row] = await db
      .insert(productos)
      .values({
        sku: p.sku,
        nombre: p.nombre,
        rubroId: p.rubroId,
        online: p.online,
      })
      .onConflictDoNothing({ target: productos.sku })
      .returning({ id: productos.id });

    if (row) {
      await db.insert(variantes).values({
        productoId: row.id,
        nombre: p.variante.nombre,
        presentacion: p.variante.presentacion,
        stockMin: p.variante.stockMin,
      });
    }
  }

  // Insumos de ejemplo (materia prima / envases).
  const seedInsumos = [
    { sku: "INS-BASE-SH", nombre: "Base para shampoo", unidad: "Litro" },
    { sku: "INS-ESENCIA-AR", nombre: "Esencia Aloe/Rosa Mosqueta", unidad: "Litro" },
    { sku: "INS-ENV-250", nombre: "Envase 250 ml", unidad: "Unidad" },
  ];
  for (const i of seedInsumos) {
    const [row] = await db
      .insert(productos)
      .values({ sku: i.sku, nombre: i.nombre, esInsumo: true })
      .onConflictDoNothing({ target: productos.sku })
      .returning({ id: productos.id });
    if (row) {
      await db
        .insert(variantes)
        .values({ productoId: row.id, nombre: i.unidad, stockMin: 0 });
    }
  }

  console.log("Seed OK: rubros, productos, insumos y medios de pago cargados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
