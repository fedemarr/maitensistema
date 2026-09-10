import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está seteada.");
}

// Pooler de Supabase en modo SESIÓN (puerto 5432).
//  - NO usar el modo transacción (6543): postgres.js pipelinea varias
//    consultas concurrentes por conexión y el pooler transaccional de
//    Supabase se cuelga con eso (páginas con Promise.all de 6+ queries).
//  - `prepare: false` porque igual pasa por el pooler.
//  - `max: 3` da lugar a unas pocas consultas en paralelo por invocación
//    serverless sin saturar la cuota del pooler; `idle_timeout` corta las
//    conexiones ociosas entre requests.
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 3,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema, casing: "snake_case" });
