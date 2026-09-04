import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  consignaciones,
  lotes,
  movimientoItemLotes,
  movimientoItems,
  movimientos,
  productos,
} from "@/db/schema";

const TIPOS_VENTA = ["venta", "venta_consignacion"] as const;

export type ClienteListItem = {
  id: string;
  nombre: string;
  tipo: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  comproUnidades: number;
  ingresos: number;
  enConsignacion: number;
};

export async function listClientes(): Promise<ClienteListItem[]> {
  const base = await db.query.clientes.findMany({
    orderBy: (c) => [asc(c.nombre)],
    columns: {
      id: true,
      nombre: true,
      tipo: true,
      email: true,
      telefono: true,
      activo: true,
    },
  });
  const ids = base.map((c) => c.id);
  if (ids.length === 0) return [];

  const ventas = await db
    .select({
      clienteId: movimientos.clienteId,
      u: sql<number>`coalesce(sum(${movimientoItems.cantidad}), 0)`,
      ing: sql<number>`coalesce(sum(${movimientoItems.ingresoNeto}), 0)`,
    })
    .from(movimientoItems)
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .where(
      and(
        inArray(movimientos.clienteId, ids),
        inArray(movimientos.tipo, TIPOS_VENTA),
      ),
    )
    .groupBy(movimientos.clienteId);
  const ventaMap = new Map(
    ventas.map((v) => [
      v.clienteId,
      { u: Number(v.u), ing: Number(v.ing) },
    ]),
  );

  const consig = await db
    .select({
      clienteId: consignaciones.clienteId,
      pend: sql<number>`coalesce(sum(${consignaciones.entregadas} - ${consignaciones.vendidas} - ${consignaciones.devueltas}), 0)`,
    })
    .from(consignaciones)
    .where(inArray(consignaciones.clienteId, ids))
    .groupBy(consignaciones.clienteId);
  const consigMap = new Map(
    consig.map((c) => [c.clienteId, Number(c.pend)]),
  );

  return base.map((c) => ({
    ...c,
    comproUnidades: ventaMap.get(c.id)?.u ?? 0,
    ingresos: ventaMap.get(c.id)?.ing ?? 0,
    enConsignacion: Math.max(0, consigMap.get(c.id) ?? 0),
  }));
}

export type Cliente = NonNullable<Awaited<ReturnType<typeof getCliente>>>;

export async function getCliente(id: string) {
  return db.query.clientes.findFirst({ where: eq(clientes.id, id) });
}

export async function nombreEnUso(
  nombre: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(
      and(
        sql`lower(${clientes.nombre}) = lower(${nombre})`,
        exceptId ? sql`${clientes.id} != ${exceptId}` : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function contarMovimientosDeCliente(
  clienteId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(movimientos)
    .where(eq(movimientos.clienteId, clienteId));
  return row?.n ?? 0;
}

/** Ficha: consignaciones y movimientos del cliente. */
export async function fichaCliente(id: string) {
  const cons = await db.query.consignaciones.findMany({
    where: eq(consignaciones.clienteId, id),
    with: {
      producto: { columns: { nombre: true } },
      lote: { columns: { nombre: true } },
    },
    orderBy: (c) => [desc(c.fecha)],
  });

  const movs = await db
    .select({
      fecha: movimientos.fecha,
      tipo: movimientos.tipo,
      producto: productos.nombre,
      lote: lotes.nombre,
      cantidad: movimientoItems.cantidad,
      ingresoNeto: movimientoItems.ingresoNeto,
      medioPago: movimientos.medioPago,
      itemId: movimientoItems.id,
    })
    .from(movimientoItems)
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .innerJoin(productos, eq(movimientoItems.productoId, productos.id))
    .leftJoin(movimientoItemLotes, eq(movimientoItemLotes.itemId, movimientoItems.id))
    .leftJoin(lotes, eq(movimientoItemLotes.loteId, lotes.id))
    .where(eq(movimientos.clienteId, id))
    .orderBy(desc(movimientos.fecha));

  const stats = {
    comproUnidades: 0,
    ingresos: 0,
    enConsignacion: cons.reduce(
      (a, c) =>
        a + Math.max(0, c.entregadas - c.vendidas - c.devueltas),
      0,
    ),
    ultimo: movs[0]?.fecha ?? null,
    movimientos: movs.length,
  };
  for (const m of movs) {
    if (m.tipo === "venta" || m.tipo === "venta_consignacion") {
      stats.comproUnidades += Math.abs(m.cantidad);
      stats.ingresos += Number(m.ingresoNeto);
    }
  }

  return {
    consignaciones: cons.map((c) => ({
      id: c.id,
      fecha: c.fecha,
      vence: c.vence,
      producto: c.producto.nombre,
      lote: c.lote.nombre,
      entregadas: c.entregadas,
      vendidas: c.vendidas,
      devueltas: c.devueltas,
      pendientes: c.entregadas - c.vendidas - c.devueltas,
    })),
    movimientos: movs,
    stats,
  };
}
