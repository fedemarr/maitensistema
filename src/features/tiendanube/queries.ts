import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { integraciones } from "@/db/schema";

export const PROVEEDOR = "tiendanube";

export type IntegracionTN = {
  estado: string;
  storeId: string | null;
  scope: string | null;
  ultimoSync: string | null;
  datos: Record<string, unknown> | null;
};

export async function getIntegracionTN(): Promise<IntegracionTN | null> {
  const row = await db.query.integraciones.findFirst({
    where: eq(integraciones.proveedor, PROVEEDOR),
  });
  if (!row) return null;
  return {
    estado: row.estado,
    storeId: row.storeId,
    scope: row.scope,
    ultimoSync: row.ultimoSync ? row.ultimoSync.toISOString() : null,
    datos: row.datos ? safe(row.datos) : null,
  };
}

/** Devuelve las credenciales si la integración está conectada, o null. */
export async function credencialesTN(): Promise<{
  storeId: string;
  token: string;
} | null> {
  const row = await db.query.integraciones.findFirst({
    where: eq(integraciones.proveedor, PROVEEDOR),
  });
  if (row?.estado === "conectado" && row.storeId && row.accessToken) {
    return { storeId: row.storeId, token: row.accessToken };
  }
  return null;
}

function safe(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
