import "server-only";

import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { movimientoItems, productos } from "@/db/schema";

export type ProductoListItem = {
  id: string;
  sku: string;
  nombre: string;
  rubro: string | null;
  precioLista: string;
  online: boolean;
  activo: boolean;
  fotoPath: string | null;
  stockTotal: number;
  bajoMinimo: boolean;
};

/** Lista de productos con stock agregado y flag de stock bajo mínimo. */
export async function listProductos(): Promise<ProductoListItem[]> {
  const rows = await db.query.productos.findMany({
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

export async function contarMovimientosDeVariante(
  varianteId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(movimientoItems)
    .where(eq(movimientoItems.varianteId, varianteId));
  return row?.n ?? 0;
}
