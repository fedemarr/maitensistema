/**
 * Ejecuta un archivo .sql contra la base (multi-statement).
 *   pnpm db:setup            -> corre supabase/setup.sql
 *   tsx scripts/db-exec-sql.ts ruta/al/archivo.sql
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";

const file = process.argv[2] ?? "supabase/setup.sql";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está seteada.");
}

const sqlText = readFileSync(resolve(process.cwd(), file), "utf8");
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

sql
  .unsafe(sqlText)
  .simple()
  .then(() => console.log(`OK: ${file} ejecutado.`))
  .catch((e) => {
    console.error(`Error ejecutando ${file}:`, e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
