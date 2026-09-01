import "server-only";

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  mediosPago,
  movimientos,
  productos,
  proveedores,
  variantes,
} from "@/db/schema";
import type { TipoMovimiento } from "./schema";

/* ── Medios de pago ────────────────────────────────────────── */

export async function listMediosPago(soloActivos = false) {
  return db.query.mediosPago.findMany({
    where: soloActivos ? eq(mediosPago.activo, true) : undefined,
    orderBy: (m) => [asc(m.nombre)],
  });
}

export type MedioPago = Awaited<ReturnType<typeof listMediosPago>>[number];

/* ── Terceros activos para los formularios ─────────────────── */

export async function listClientesActivos() {
  return db.query.clientes.findMany({
    where: eq(clientes.activo, true),
    orderBy: (c) => [asc(c.nombre)],
    columns: { id: true, nombre: true },
  });
}

export async function listProveedoresActivos() {
  return db.query.proveedores.findMany({
    where: eq(proveedores.activo, true),
    orderBy: (p) => [asc(p.nombre)],
    columns: { id: true, nombre: true },
  });
}

/* ── Catálogo para el selector de ítems ────────────────────── */

export type VarianteCatalogo = {
  id: string;
  nombre: string;
  productoId: string;
  productoSku: string;
  productoNombre: string;
  stock: number;
  precioLista: string;
  costoPromedio: string;
  activoProducto: boolean;
};

/** Variantes activas (de productos activos) para armar ítems de movimiento. */
export async function listVariantesActivas(): Promise<VarianteCatalogo[]> {
  const rows = await db
    .select({
      id: variantes.id,
      nombre: variantes.nombre,
      productoId: variantes.productoId,
      productoSku: productos.sku,
      productoNombre: productos.nombre,
      stock: variantes.stock,
      precioLista: productos.precioLista,
      costoPromedio: variantes.costoPromedio,
      activoProducto: productos.activo,
    })
    .from(variantes)
    .innerJoin(productos, eq(variantes.productoId, productos.id))
    .where(eq(variantes.activo, true))
    .orderBy(asc(productos.nombre), asc(variantes.nombre));

  return rows;
}

/* ── Movimientos ───────────────────────────────────────────── */

export type FiltrosMovimientos = {
  tipo?: TipoMovimiento;
  desde?: string;
  hasta?: string;
  terceroId?: string;
};

export async function listMovimientos(filtros: FiltrosMovimientos) {
  const conditions = [];

  if (filtros.tipo) conditions.push(eq(movimientos.tipo, filtros.tipo));
  if (filtros.desde) conditions.push(gte(movimientos.fecha, filtros.desde));
  if (filtros.hasta) conditions.push(lte(movimientos.fecha, filtros.hasta));
  if (filtros.terceroId) {
    conditions.push(
      sql`(${movimientos.clienteId} = ${filtros.terceroId} or ${movimientos.proveedorId} = ${filtros.terceroId})`,
    );
  }

  return db.query.movimientos.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: (m) => [desc(m.fecha), desc(m.createdAt)],
    with: {
      cliente: { columns: { nombre: true } },
      proveedor: { columns: { nombre: true } },
      medioPago: { columns: { nombre: true } },
      items: { columns: { id: true } },
    },
  });
}

export type MovimientoListItem = Awaited<
  ReturnType<typeof listMovimientos>
>[number];

export async function getMovimiento(id: string) {
  return db.query.movimientos.findFirst({
    where: eq(movimientos.id, id),
    with: {
      cliente: { columns: { nombre: true } },
      proveedor: { columns: { nombre: true } },
      medioPago: { columns: { nombre: true } },
      creador: { columns: { nombre: true } },
      items: {
        with: {
          variante: {
            columns: { nombre: true },
            with: {
              producto: { columns: { nombre: true, sku: true } },
            },
          },
        },
      },
    },
  });
}

export type Movimiento = NonNullable<Awaited<ReturnType<typeof getMovimiento>>>;

/** Total en número (los `numeric` llegan como string). */
export function totalMovimiento(m: { total: string }): number {
  return Number(m.total);
}
