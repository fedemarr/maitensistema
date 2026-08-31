import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está seteada.");
}

// `prepare: false` es requerido con el pooler en modo transacción de Supabase.
const client = postgres(process.env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema, casing: "snake_case" });
