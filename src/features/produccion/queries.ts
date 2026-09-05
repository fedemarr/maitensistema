import "server-only";

import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  minimoCompraFabrica,
  ordenesProduccion,
  preciosFabricacion,
  productos,
  recetas,
} from "@/db/schema";
import type { EstadoOrden } from "./schema";

/** Precio de fabricación por unidad vigente a una fecha, para un producto. */
export async function precioFabricacionVigente(
  productoId: string,
  fecha: string,
): Promise<number | null> {
  const [row] = await db
    .select({ p: preciosFabricacion.precioUnitario })
    .from(preciosFabricacion)
    .where(
      and(
        eq(preciosFabricacion.productoId, productoId),
        lte(preciosFabricacion.vigenteDesde, fecha),
      ),
    )
    .orderBy(desc(preciosFabricacion.vigenteDesde))
    .limit(1);
  if (row) return Number(row.p);
  const [any] = await db
    .select({ p: preciosFabricacion.precioUnitario })
    .from(preciosFabricacion)
    .where(eq(preciosFabricacion.productoId, productoId))
    .orderBy(asc(preciosFabricacion.vigenteDesde))
    .limit(1);
  return any ? Number(any.p) : null;
}

/** Mínimo de compra por orden vigente a una fecha. Devuelve monto + id de la vigencia. */
export async function minimoVigente(fecha: string) {
  const [row] = await db
    .select({ id: minimoCompraFabrica.id, monto: minimoCompraFabrica.monto })
    .from(minimoCompraFabrica)
    .where(lte(minimoCompraFabrica.vigenteDesde, fecha))
    .orderBy(desc(minimoCompraFabrica.vigenteDesde))
    .limit(1);
  if (row) return { id: row.id, monto: Number(row.monto) };
  const [any] = await db
    .select({ id: minimoCompraFabrica.id, monto: minimoCompraFabrica.monto })
    .from(minimoCompraFabrica)
    .orderBy(asc(minimoCompraFabrica.vigenteDesde))
    .limit(1);
  return any ? { id: any.id, monto: Number(any.monto) } : null;
}

export type VigenciaFila = {
  id: string;
  producto: string | null;
  monto: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  ordenes: number;
  creador: string | null;
};

/** Tarifario: precio vigente por producto + historial completo con # de órdenes. */
export async function tarifarioFabrica() {
  const productosRows = await db
    .select({ id: productos.id, nombre: productos.nombre })
    .from(productos)
    .where(eq(productos.esInsumo, false))
    .orderBy(asc(productos.nombre));

  const precios = await db
    .select({
      id: preciosFabricacion.id,
      productoId: preciosFabricacion.productoId,
      producto: productos.nombre,
      monto: preciosFabricacion.precioUnitario,
      vigenteDesde: preciosFabricacion.vigenteDesde,
      vigenteHasta: preciosFabricacion.vigenteHasta,
      creador: sql<string | null>`null`,
    })
    .from(preciosFabricacion)
    .innerJoin(productos, eq(productos.id, preciosFabricacion.productoId))
    .orderBy(asc(productos.nombre), asc(preciosFabricacion.vigenteDesde));

  const historial: VigenciaFila[] = precios.map((p) => ({
    id: p.id,
    producto: p.producto,
    monto: Number(p.monto),
    vigenteDesde: p.vigenteDesde,
    vigenteHasta: p.vigenteHasta,
    ordenes: 0,
    creador: p.creador,
  }));

  return {
    productos: productosRows,
    historial,
  };
}

/** Mínimo vigente + historial con # de órdenes que usaron cada vigencia. */
export async function historialMinimo() {
  const rows = await db
    .select({
      id: minimoCompraFabrica.id,
      monto: minimoCompraFabrica.monto,
      vigenteDesde: minimoCompraFabrica.vigenteDesde,
      vigenteHasta: minimoCompraFabrica.vigenteHasta,
    })
    .from(minimoCompraFabrica)
    .orderBy(asc(minimoCompraFabrica.vigenteDesde));

  const conteos = await db
    .select({
      minimoId: ordenesProduccion.minimoCompraId,
      n: sql<number>`count(*)::int`,
    })
    .from(ordenesProduccion)
    .groupBy(ordenesProduccion.minimoCompraId);
  const nPorId = new Map(conteos.map((c) => [c.minimoId, c.n]));

  return rows.map((r, i) => ({
    id: r.id,
    monto: Number(r.monto),
    vigenteDesde: r.vigenteDesde,
    vigenteHasta:
      r.vigenteHasta ?? (i === rows.length - 1 ? null : rows[i + 1].vigenteDesde),
    variacion:
      i > 0 && Number(rows[i - 1].monto) > 0
        ? (Number(r.monto) - Number(rows[i - 1].monto)) / Number(rows[i - 1].monto)
        : null,
    ordenes: nPorId.get(r.id) ?? 0,
  }));
}

/** Fabricación cotizada acumulada por lote (planificadas + cerradas). */
export async function fabricacionPorLoteMap(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      loteId: ordenesProduccion.loteId,
      total: sql<number>`coalesce(sum(${ordenesProduccion.fabricacionCotizada}), 0)`,
    })
    .from(ordenesProduccion)
    .where(sql`${ordenesProduccion.estado} <> 'anulada'`)
    .groupBy(ordenesProduccion.loteId);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.loteId] = Number(r.total);
  return out;
}

/** Historial de precio de fabricación agrupado por producto (para el planificador). */
export async function preciosFabPorProducto(): Promise<
  Record<string, { monto: number; vigenteDesde: string; vigenteHasta: string | null }[]>
> {
  const rows = await db
    .select({
      productoId: preciosFabricacion.productoId,
      monto: preciosFabricacion.precioUnitario,
      vigenteDesde: preciosFabricacion.vigenteDesde,
      vigenteHasta: preciosFabricacion.vigenteHasta,
    })
    .from(preciosFabricacion)
    .orderBy(asc(preciosFabricacion.vigenteDesde));
  const out: Record<
    string,
    { monto: number; vigenteDesde: string; vigenteHasta: string | null }[]
  > = {};
  for (const r of rows) {
    (out[r.productoId] ??= []).push({
      monto: Number(r.monto),
      vigenteDesde: r.vigenteDesde,
      vigenteHasta: r.vigenteHasta,
    });
  }
  return out;
}

/** Historial del mínimo, formato para el planificador. */
export async function minimosVigencias(): Promise<
  { monto: number; vigenteDesde: string; vigenteHasta: string | null }[]
> {
  const rows = await db
    .select({
      monto: minimoCompraFabrica.monto,
      vigenteDesde: minimoCompraFabrica.vigenteDesde,
      vigenteHasta: minimoCompraFabrica.vigenteHasta,
    })
    .from(minimoCompraFabrica)
    .orderBy(asc(minimoCompraFabrica.vigenteDesde));
  return rows.map((r) => ({
    monto: Number(r.monto),
    vigenteDesde: r.vigenteDesde,
    vigenteHasta: r.vigenteHasta,
  }));
}

export type LineaPlan = {
  insumoId: string;
  nombre: string;
  unidad: "kg" | "u";
  cantidadPorUnidad: number;
  ppp: number;
  stock: number;
};

/** Receta vigente de un terminado + stock y PPP de cada insumo (para planificar). */
export async function recetaConStock(productoId: string): Promise<LineaPlan[]> {
  const r = await db.query.recetas.findFirst({
    where: and(
      eq(recetas.productoId, productoId),
      isNull(recetas.vigenteHasta),
    ),
    with: {
      lineas: {
        with: {
          insumo: {
            columns: {
              nombre: true,
              unidad: true,
              ppp: true,
              stockInsumo: true,
            },
          },
        },
      },
    },
  });
  if (!r) return [];
  return r.lineas.map((l) => ({
    insumoId: l.insumoId,
    nombre: l.insumo.nombre,
    unidad: (l.insumo.unidad ?? "kg") as "kg" | "u",
    cantidadPorUnidad: Number(l.cantidadPorUnidad),
    ppp: Number(l.insumo.ppp),
    stock: Number(l.insumo.stockInsumo),
  }));
}

/** Terminados que tienen receta vigente (para el selector de planificación). */
export async function terminadosConReceta() {
  const rows = await db
    .select({ id: productos.id, nombre: productos.nombre })
    .from(recetas)
    .innerJoin(productos, eq(recetas.productoId, productos.id))
    .where(isNull(recetas.vigenteHasta))
    .orderBy(asc(productos.nombre));
  return rows;
}

export type OrdenListItem = {
  id: string;
  fecha: string;
  producto: string;
  lote: string;
  estado: EstadoOrden;
  planificadas: number;
  obtenidas: number | null;
  rendimiento: number | null;
  precioFabricacion: string;
  minimoAplicado: string;
  costoUnitario: string | null;
  desvioMp: string;
  desvioFabricacion: string;
};

export async function listOrdenes(): Promise<OrdenListItem[]> {
  const rows = await db.query.ordenesProduccion.findMany({
    with: {
      producto: { columns: { nombre: true } },
      lote: { columns: { nombre: true } },
    },
    orderBy: (o) => [desc(o.fechaPrevista), desc(o.createdAt)],
  });
  return rows.map((o) => ({
    id: o.id,
    fecha: o.fechaPrevista,
    producto: o.producto.nombre,
    lote: o.lote.nombre,
    estado: o.estado,
    planificadas: o.unidadesPlanificadas,
    obtenidas: o.unidadesObtenidas,
    rendimiento:
      o.unidadesObtenidas != null && o.unidadesPlanificadas > 0
        ? o.unidadesObtenidas / o.unidadesPlanificadas
        : null,
    precioFabricacion: o.precioFabricacionUnitario,
    minimoAplicado: o.minimoCompraAplicado,
    costoUnitario: o.costoUnitario,
    desvioMp: o.desvioMp,
    desvioFabricacion: o.desvioFabricacion,
  }));
}

export type LineaCierre = {
  insumoId: string;
  nombre: string;
  unidad: "kg" | "u";
  cantidadEstandar: number;
  consumoTeorico: number;
  ppp: number;
  stock: number;
};

export type OrdenParaCerrar = {
  id: string;
  productoNombre: string;
  loteNombre: string;
  estado: EstadoOrden;
  unidadesPlanificadas: number;
  fabricacionCotizada: string;
  lineas: LineaCierre[];
};

export async function getOrdenParaCerrar(
  id: string,
): Promise<OrdenParaCerrar | null> {
  const o = await db.query.ordenesProduccion.findFirst({
    where: eq(ordenesProduccion.id, id),
    with: {
      producto: { columns: { nombre: true } },
      lote: { columns: { nombre: true } },
      lineas: {
        with: {
          insumo: {
            columns: {
              nombre: true,
              unidad: true,
              ppp: true,
              stockInsumo: true,
            },
          },
        },
      },
    },
  });
  if (!o) return null;
  return {
    id: o.id,
    productoNombre: o.producto.nombre,
    loteNombre: o.lote.nombre,
    estado: o.estado,
    unidadesPlanificadas: o.unidadesPlanificadas,
    fabricacionCotizada: o.fabricacionCotizada,
    lineas: o.lineas.map((l) => ({
      insumoId: l.insumoId,
      nombre: l.insumo.nombre,
      unidad: (l.insumo.unidad ?? "kg") as "kg" | "u",
      cantidadEstandar: Number(l.cantidadEstandar),
      consumoTeorico: Number(l.consumoTeorico),
      ppp: Number(l.insumo.ppp),
      stock: Number(l.insumo.stockInsumo),
    })),
  };
}

/** Costo estándar estimado del lote = Σ (receta × cantidad × PPP). */
export function costoEstandarLote(lineas: LineaPlan[], cantidad: number) {
  return lineas.reduce(
    (a, l) => a + l.cantidadPorUnidad * cantidad * l.ppp,
    0,
  );
}
