import "server-only";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";

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
import type { TipoManual } from "./schema";

export type MovimientoRow = {
  movimientoId: string;
  itemId: string;
  fecha: string;
  tipo: TipoManual | "produccion";
  producto: string;
  cliente: string | null;
  medioPago: string | null;
  lotes: string;
  cantidad: number;
  ingresoNeto: string;
  costo: string;
};

export type FiltrosMovimientos = {
  tipo?: string;
  productoId?: string;
  desde?: string;
  hasta?: string;
};

/** Historial: una fila por ítem de movimiento, recientes primero. */
export async function listMovimientos(
  f: FiltrosMovimientos = {},
): Promise<MovimientoRow[]> {
  const cond = [];
  if (f.tipo) cond.push(eq(movimientos.tipo, f.tipo as TipoManual));
  if (f.productoId) cond.push(eq(movimientoItems.productoId, f.productoId));
  if (f.desde) cond.push(gte(movimientos.fecha, f.desde));
  if (f.hasta) cond.push(lte(movimientos.fecha, f.hasta));

  const rows = await db
    .select({
      movimientoId: movimientos.id,
      itemId: movimientoItems.id,
      fecha: movimientos.fecha,
      tipo: movimientos.tipo,
      producto: productos.nombre,
      cliente: clientes.nombre,
      medioPago: movimientos.medioPago,
      cantidad: movimientoItems.cantidad,
      ingresoNeto: movimientoItems.ingresoNeto,
      costo: movimientoItems.costo,
      createdAt: movimientos.createdAt,
    })
    .from(movimientoItems)
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .innerJoin(productos, eq(movimientoItems.productoId, productos.id))
    .leftJoin(clientes, eq(movimientos.clienteId, clientes.id))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(movimientos.fecha), desc(movimientos.createdAt));

  const itemIds = rows.map((r) => r.itemId);
  const lotesByItem = new Map<string, string[]>();
  if (itemIds.length) {
    const mils = await db
      .select({
        itemId: movimientoItemLotes.itemId,
        nombre: lotes.nombre,
        cantidad: movimientoItemLotes.cantidad,
      })
      .from(movimientoItemLotes)
      .innerJoin(lotes, eq(movimientoItemLotes.loteId, lotes.id))
      .where(inArray(movimientoItemLotes.itemId, itemIds));
    for (const m of mils) {
      if (!lotesByItem.has(m.itemId)) lotesByItem.set(m.itemId, []);
      lotesByItem
        .get(m.itemId)!
        .push(`${m.nombre.replace("Lote N.º ", "L")} ×${m.cantidad}`);
    }
  }

  return rows.map((r) => ({
    movimientoId: r.movimientoId,
    itemId: r.itemId,
    fecha: r.fecha,
    tipo: r.tipo,
    producto: r.producto,
    cliente: r.cliente,
    medioPago: r.medioPago,
    lotes: (lotesByItem.get(r.itemId) ?? []).join(" · ") || "—",
    cantidad: r.cantidad,
    ingresoNeto: r.ingresoNeto,
    costo: r.costo,
  }));
}

/** Productos terminados activos para el selector de ítems. */
export async function listProductosVenta() {
  return db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      ppp: productos.ppp,
    })
    .from(productos)
    .where(and(eq(productos.esInsumo, false), eq(productos.activo, true)))
    .orderBy(asc(productos.nombre));
}

export async function listClientesActivos() {
  return db
    .select({ id: clientes.id, nombre: clientes.nombre, tipo: clientes.tipo })
    .from(clientes)
    .where(eq(clientes.activo, true))
    .orderBy(asc(clientes.nombre));
}

/** Consignaciones abiertas de un cliente para un producto (para venta/devolución). */
export async function consignacionesAbiertas(
  clienteId: string,
  productoId: string,
) {
  const rows = await db
    .select()
    .from(consignaciones)
    .where(
      and(
        eq(consignaciones.clienteId, clienteId),
        eq(consignaciones.productoId, productoId),
      ),
    )
    .orderBy(asc(consignaciones.fecha));
  return rows
    .map((c) => ({ ...c, pendientes: c.entregadas - c.vendidas - c.devueltas }))
    .filter((c) => c.pendientes > 0);
}
