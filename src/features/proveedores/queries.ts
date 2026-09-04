import "server-only";

import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { comprasInsumo, lotes, proveedores } from "@/db/schema";
import { historialCc, saldoEntidad, saldosPorTipo } from "@/features/cc/queries";

export type ProveedorListItem = {
  id: string;
  nombre: string;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  saldoCc: number;
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

  const saldoMap = await saldosPorTipo("proveedor");

  return rows.map((r) => ({ ...r, saldoCc: saldoMap.get(r.id) ?? 0 }));
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

/** Cuenta cuántas compras de insumo referencian a este proveedor. */
export async function contarMovimientosDeProveedor(
  proveedorId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(comprasInsumo)
    .where(eq(comprasInsumo.proveedorId, proveedorId));
  return row?.n ?? 0;
}

/** Ficha: saldo de cuenta corriente, su historial y las compras al proveedor. */
export async function fichaProveedor(id: string) {
  const [saldoCc, cc, compras] = await Promise.all([
    saldoEntidad("proveedor", id),
    historialCc("proveedor", id),
    db
      .select({
        id: comprasInsumo.id,
        fecha: comprasInsumo.fecha,
        total: comprasInsumo.total,
        medioPago: comprasInsumo.medioPago,
        lote: lotes.nombre,
      })
      .from(comprasInsumo)
      .leftJoin(lotes, eq(comprasInsumo.loteId, lotes.id))
      .where(eq(comprasInsumo.proveedorId, id))
      .orderBy(desc(comprasInsumo.fecha)),
  ]);
  return { saldoCc, cc, compras };
}
