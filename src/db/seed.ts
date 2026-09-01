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
  const { rubros, productos, variantes } = schema;

  await db
    .insert(rubros)
    .values([{ nombre: "Capilar" }, { nombre: "Corporal" }])
    .onConflictDoNothing();

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

  console.log("Seed OK: rubros y productos de ejemplo cargados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
