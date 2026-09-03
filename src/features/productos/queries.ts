import "server-only";

import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { ordenesProduccion, productos, recetas } from "@/db/schema";

export type ProductoListItem = {
  id: string;
  sku: string;
  nombre: string;
  rubro: string | null;
  presentacion: string | null;
  stockMinimo: number;
  online: boolean;
  activo: boolean;
  ppp: string;
  stockDeposito: number;
  tieneReceta: boolean;
};

/** Lista de productos terminados con stock en depósito y flag de receta. */
export async function listProductos(): Promise<ProductoListItem[]> {
  const rows = await db.query.productos.findMany({
    where: eq(productos.esInsumo, false),
    with: {
      rubro: { columns: { nombre: true } },
      stockLotes: { columns: { unidadesEnDeposito: true } },
      recetas: { columns: { id: true, vigenteHasta: true } },
    },
    orderBy: (p) => [asc(p.nombre)],
  });

  return rows.map((p) => ({
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    rubro: p.rubro?.nombre ?? null,
    presentacion: p.presentacion,
    stockMinimo: p.stockMinimo,
    online: p.online,
    activo: p.activo,
    ppp: p.ppp,
    stockDeposito: p.stockLotes.reduce((a, s) => a + s.unidadesEnDeposito, 0),
    tieneReceta: p.recetas.some((r) => r.vigenteHasta === null),
  }));
}

export async function getProducto(id: string) {
  return db.query.productos.findFirst({
    where: eq(productos.id, id),
    with: { rubro: { columns: { nombre: true } } },
  });
}
export type Producto = NonNullable<Awaited<ReturnType<typeof getProducto>>>;

export type RecetaLineaDetalle = {
  id: string;
  insumoId: string;
  insumoNombre: string;
  unidad: "kg" | "u";
  cantidadPorUnidad: string;
};
export type RecetaDetalle = {
  id: string;
  numero: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  notas: string | null;
  lineas: RecetaLineaDetalle[];
};

async function mapReceta(recetaId: string): Promise<RecetaDetalle | null> {
  const r = await db.query.recetas.findFirst({
    where: eq(recetas.id, recetaId),
    with: {
      lineas: {
        with: { insumo: { columns: { nombre: true, unidad: true } } },
      },
    },
  });
  if (!r) return null;
  return {
    id: r.id,
    numero: r.numero,
    vigenteDesde: r.vigenteDesde,
    vigenteHasta: r.vigenteHasta,
    notas: r.notas,
    lineas: r.lineas.map((l) => ({
      id: l.id,
      insumoId: l.insumoId,
      insumoNombre: l.insumo.nombre,
      unidad: (l.insumo.unidad ?? "kg") as "kg" | "u",
      cantidadPorUnidad: l.cantidadPorUnidad,
    })),
  };
}

/** Receta vigente (vigente_hasta null) de un producto. */
export async function getRecetaVigente(
  productoId: string,
): Promise<RecetaDetalle | null> {
  const r = await db.query.recetas.findFirst({
    where: and(
      eq(recetas.productoId, productoId),
      isNull(recetas.vigenteHasta),
    ),
  });
  return r ? mapReceta(r.id) : null;
}

/** Todas las versiones de receta de un producto, con los lotes que la usaron. */
export async function listVersionesReceta(productoId: string) {
  const rs = await db.query.recetas.findMany({
    where: eq(recetas.productoId, productoId),
    orderBy: (r) => [desc(r.numero)],
  });

  const out = [];
  for (const r of rs) {
    const lotesUsados = await db
      .select({ lote: sql<string>`count(*)::int` })
      .from(ordenesProduccion)
      .where(eq(ordenesProduccion.recetaId, r.id));
    out.push({
      id: r.id,
      numero: r.numero,
      vigenteDesde: r.vigenteDesde,
      vigenteHasta: r.vigenteHasta,
      vigente: r.vigenteHasta === null,
      notas: r.notas,
      ordenes: Number(lotesUsados[0]?.lote ?? 0),
    });
  }
  return out;
}

/** Insumos activos para el editor de recetas. */
export async function listInsumosActivos() {
  return db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      unidad: productos.unidad,
      ppp: productos.ppp,
    })
    .from(productos)
    .where(and(eq(productos.esInsumo, true), eq(productos.activo, true)))
    .orderBy(asc(productos.nombre));
}
export type InsumoOpcion = Awaited<
  ReturnType<typeof listInsumosActivos>
>[number];

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
