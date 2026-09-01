/**
 * Deja la base de DESARROLLO lista para probar de cero.
 *   pnpm dev:reset
 *
 * Borra SOLO datos operativos de prueba (movimientos, asientos, CC,
 * consignaciones, auditoría) y pone el stock/costo de las variantes en 0.
 * NO toca: perfiles/usuarios, rubros, productos, variantes (salvo stock),
 * medios de pago ni plan de cuentas.
 *
 * Motivo: el testing E2E de la Fase 2 dejó movimientos de prueba y 2 variantes
 * con stock -1, lo que impide aplicar la migración 0004 (CHECK stock >= 0).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está seteada.");

const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const db = drizzle(client, { schema, casing: "snake_case" });

async function main() {
  await db.execute(/* sql */ `
    delete from asiento_lineas;
    delete from asientos;
    delete from cc_movimientos;
    delete from consignaciones;
    delete from movimiento_items;
    delete from movimientos;
    delete from auditoria;
    update variantes set stock = 0, costo_promedio = 0;
  `);
  console.log("Datos operativos de prueba borrados. Stock de variantes en 0.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
