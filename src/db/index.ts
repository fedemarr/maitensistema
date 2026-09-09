import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está seteada.");
}

// Pooler de Supabase en modo transacción (puerto 6543):
//  - `prepare: false` es obligatorio (no soporta prepared statements).
//  - `max: 1` porque cada invocación serverless es efímera; abrir muchas
//    conexiones por función solo agrega latencia y satura el pooler.
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema, casing: "snake_case" });
