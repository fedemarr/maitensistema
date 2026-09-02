import "server-only";

import { and, asc, count, desc, eq, gte, lte, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  mediosPago,
  movimientoItems,
  movimientos,
  productos,
  proveedores,
  variantes,
} from "@/db/schema";
import type { TipoMovimiento } from "@/features/movimientos/schema";

export type ProductoListItem = {
  id: string;
  sku: string;
  nombre: string;
  rubro: string | null;
  precioLista: string;
  online: boolean;
  activo: boolean;
  esInsumo: boolean;
  fotoPath: string | null;
  stockTotal: number;
  bajoMinimo: boolean;
};

/** Lista de productos con stock agregado y flag de stock bajo mínimo. */
export async function listProductos(
  opts: { esInsumo?: boolean } = {},
): Promise<ProductoListItem[]> {
  const rows = await db.query.productos.findMany({
    where:
      opts.esInsumo === undefined
        ? undefined
        : eq(productos.esInsumo, opts.esInsumo),
    with: {
      rubro: true,
      variantes: { columns: { stock: true, stockMin: true, activo: true } },
    },
    orderBy: (p) => [asc(p.nombre)],
  });

  return rows.map((p) => {
    const vs = p.variantes.filter((v) => v.activo);
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      rubro: p.rubro?.nombre ?? null,
      precioLista: p.precioLista,
      online: p.online,
      activo: p.activo,
      esInsumo: p.esInsumo,
      fotoPath: p.fotoPath,
      stockTotal: vs.reduce((acc, v) => acc + v.stock, 0),
      bajoMinimo: vs.some((v) => v.stock < v.stockMin),
    };
  });
}

export async function getProducto(id: string) {
  return db.query.productos.findFirst({
    where: eq(productos.id, id),
    with: {
      rubro: true,
      variantes: { orderBy: (v) => [asc(v.nombre)] },
    },
  });
}

export type ProductoConVariantes = NonNullable<
  Awaited<ReturnType<typeof getProducto>>
>;

/** SKU ya usado por otro producto (validación de unicidad, case-insensitive). */
export async function skuEnUso(sku: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: productos.id })
    .from(productos)
    .where(
      and(
        sql`lower(${productos.sku}) = lower(${sku})`,
        exceptId ? ne(productos.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export type VarianteOpcion = {
  varianteId: string;
  label: string;
  stock: number;
  costoPromedio: string;
};

/** Variantes activas de productos terminados (esInsumo=false) o insumos (true). */
export async function listVariantesActivas(
  esInsumo: boolean,
): Promise<VarianteOpcion[]> {
  const rows = await db
    .select({
      varianteId: variantes.id,
      varianteNombre: variantes.nombre,
      productoNombre: productos.nombre,
      stock: variantes.stock,
      costoPromedio: variantes.costoPromedio,
    })
    .from(variantes)
    .innerJoin(productos, eq(variantes.productoId, productos.id))
    .where(
      and(
        eq(variantes.activo, true),
        eq(productos.activo, true),
        eq(productos.esInsumo, esInsumo),
      ),
    )
    .orderBy(asc(productos.nombre), asc(variantes.nombre));

  return rows.map((r) => ({
    varianteId: r.varianteId,
    label: `${r.productoNombre} — ${r.varianteNombre}`,
    stock: r.stock,
    costoPromedio: r.costoPromedio,
  }));
}

export async function contarMovimientosDeVariante(
  varianteId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(movimientoItems)
    .where(eq(movimientoItems.varianteId, varianteId));
  return row?.n ?? 0;
}

export type MovimientoProducto = {
  itemId: string;
  varianteId: string;
  varianteNombre: string;
  cantidad: number;
  precioUnit: string;
  costoUnit: string;
  movimientoId: string;
  tipo: TipoMovimiento;
  fecha: string;
  notas: string | null;
  medioPago: string | null;
  clienteNombre: string | null;
  proveedorNombre: string | null;
};

export type FiltrosHistorico =
  | {
      tipo?: TipoMovimiento;
      desde?: string;
      hasta?: string;
    }
  | undefined;

/** Ítems de movimiento del producto (de todas sus variantes), recientes primero. */
export async function listMovimientosDeProducto(
  productoId: string,
  filtros: FiltrosHistorico = {},
): Promise<MovimientoProducto[]> {
  const conditions = [eq(variantes.productoId, productoId)];
  if (filtros.tipo) conditions.push(eq(movimientos.tipo, filtros.tipo));
  if (filtros.desde) conditions.push(gte(movimientos.fecha, filtros.desde));
  if (filtros.hasta) conditions.push(lte(movimientos.fecha, filtros.hasta));

  return db
    .select({
      itemId: movimientoItems.id,
      varianteId: movimientoItems.varianteId,
      varianteNombre: variantes.nombre,
      cantidad: movimientoItems.cantidad,
      precioUnit: movimientoItems.precioUnit,
      costoUnit: movimientoItems.costoUnit,
      movimientoId: movimientos.id,
      tipo: movimientos.tipo,
      fecha: movimientos.fecha,
      notas: movimientos.notas,
      medioPago: mediosPago.nombre,
      clienteNombre: clientes.nombre,
      proveedorNombre: proveedores.nombre,
    })
    .from(movimientoItems)
    .innerJoin(variantes, eq(movimientoItems.varianteId, variantes.id))
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .leftJoin(mediosPago, eq(movimientos.medioPagoId, mediosPago.id))
    .leftJoin(clientes, eq(movimientos.clienteId, clientes.id))
    .leftJoin(proveedores, eq(movimientos.proveedorId, proveedores.id))
    .where(and(...conditions))
    .orderBy(desc(movimientos.fecha), desc(movimientos.createdAt));
}
