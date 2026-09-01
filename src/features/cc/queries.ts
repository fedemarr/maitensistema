import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { ccMovimientos, clientes, proveedores } from "@/db/schema";

export type EntidadTipo = "cliente" | "proveedor";

export type TerceroConSaldo = {
  id: string;
  nombre: string;
  activo: boolean;
  saldo: number;
};

const SALDO_SQL = sql<number>`coalesce(sum(coalesce(${ccMovimientos.debe}, 0) - coalesce(${ccMovimientos.haber}, 0)), 0)`;

export async function listClientesConSaldo(): Promise<TerceroConSaldo[]> {
  const rows = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      activo: clientes.activo,
      saldo: SALDO_SQL,
    })
    .from(clientes)
    .leftJoin(
      ccMovimientos,
      and(
        eq(ccMovimientos.entidadId, clientes.id),
        eq(ccMovimientos.entidadTipo, "cliente"),
      ),
    )
    .groupBy(clientes.id, clientes.nombre, clientes.activo)
    .orderBy(asc(clientes.nombre));
  return rows.map((r) => ({ ...r, saldo: Number(r.saldo) }));
}

export async function listProveedoresConSaldo(): Promise<TerceroConSaldo[]> {
  const rows = await db
    .select({
      id: proveedores.id,
      nombre: proveedores.nombre,
      activo: proveedores.activo,
      saldo: SALDO_SQL,
    })
    .from(proveedores)
    .leftJoin(
      ccMovimientos,
      and(
        eq(ccMovimientos.entidadId, proveedores.id),
        eq(ccMovimientos.entidadTipo, "proveedor"),
      ),
    )
    .groupBy(proveedores.id, proveedores.nombre, proveedores.activo)
    .orderBy(asc(proveedores.nombre));
  return rows.map((r) => ({ ...r, saldo: Number(r.saldo) }));
}

export async function getTerceroSaldo(
  entidadTipo: EntidadTipo,
  entidadId: string,
): Promise<number> {
  const [row] = await db
    .select({ saldo: SALDO_SQL })
    .from(ccMovimientos)
    .where(
      and(
        eq(ccMovimientos.entidadId, entidadId),
        eq(ccMovimientos.entidadTipo, entidadTipo),
      ),
    );
  return Number(row?.saldo ?? 0);
}

export async function listAsientosDeTercero(
  entidadTipo: EntidadTipo,
  entidadId: string,
) {
  return db.query.ccMovimientos.findMany({
    where: and(
      eq(ccMovimientos.entidadId, entidadId),
      eq(ccMovimientos.entidadTipo, entidadTipo),
    ),
    orderBy: (c) => [desc(c.fecha), desc(c.createdAt)],
    with: { movimiento: { columns: { id: true, tipo: true } } },
  });
}

export type AsientoCC = Awaited<
  ReturnType<typeof listAsientosDeTercero>
>[number];