import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { movimientos, proveedores } from "@/db/schema";

export type ProveedorListItem = {
  id: string;
  nombre: string;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
};

/** Lista de proveedores. */
export async function listProveedores(
  q?: string,
): Promise<ProveedorListItem[]> {
  const conditions = [];

  if (q) {
    conditions.push(sql`lower(${proveedores.nombre}) like ${`%${q.toLowerCase()}%`}`);
  }

  const rows = await db.query.proveedores.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (p) => [asc(p.nombre)],
    columns: {
      id: true,
      nombre: true,
      cuit: true,
      email: true,
      telefono: true,
      activo: true,
    },
  });

  return rows;
}

export type Proveedor = NonNullable<Awaited<ReturnType<typeof getProveedor>>>;

export async function getProveedor(id: string) {
  return db.query.proveedores.findFirst({
    where: eq(proveedores.id, id),
  });
}

/** Nombre ya usado por otro proveedor (validación de unicidad, case-insensitive). */
export async function nombreEnUso(
  nombre: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: proveedores.id })
    .from(proveedores)
    .where(
      and(
        sql`lower(${proveedores.nombre}) = lower(${nombre})`,
        exceptId ? sql`${proveedores.id} != ${exceptId}` : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Cuenta cuántos movimientos usa a este proveedor. */
export async function contarMovimientosDeProveedor(
  proveedorId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(movimientos)
    .where(eq(movimientos.proveedorId, proveedorId));
  return row?.n ?? 0;
}
