import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  bajasInsumo,
  compraInsumoLineas,
  comprasInsumo,
  lotes,
  ordenLineas,
  ordenesProduccion,
  productos,
  recetaLineas,
  recetas,
} from "@/db/schema";

export type InsumoListItem = {
  id: string;
  sku: string;
  nombre: string;
  unidad: "kg" | "u";
  reutilizable: boolean;
  vence: boolean;
  activo: boolean;
  stock: number;
  ppp: number;
  valorStock: number;
  loUsa: string[];
};

/** Listado de insumos con stock, PPP, valor y qué productos lo usan. */
export async function listInsumos(): Promise<InsumoListItem[]> {
  const rows = await db.query.productos.findMany({
    where: eq(productos.esInsumo, true),
    orderBy: (p) => [asc(p.nombre)],
  });

  // Qué producto terminado usa cada insumo (por receta vigente).
  const usos = await db
    .select({
      insumoId: recetaLineas.insumoId,
      producto: productos.nombre,
    })
    .from(recetaLineas)
    .innerJoin(recetas, eq(recetaLineas.recetaId, recetas.id))
    .innerJoin(productos, eq(recetas.productoId, productos.id))
    .where(sql`${recetas.vigenteHasta} is null`);

  const usoPorInsumo = new Map<string, Set<string>>();
  for (const u of usos) {
    if (!usoPorInsumo.has(u.insumoId)) usoPorInsumo.set(u.insumoId, new Set());
    usoPorInsumo.get(u.insumoId)!.add(u.producto);
  }

  return rows.map((p) => {
    const stock = Number(p.stockInsumo);
    const ppp = Number(p.ppp);
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      unidad: (p.unidad ?? "kg") as "kg" | "u",
      reutilizable: p.reutilizable,
      vence: p.vence,
      activo: p.activo,
      stock,
      ppp,
      valorStock: stock * ppp,
      loUsa: [...(usoPorInsumo.get(p.id) ?? [])],
    };
  });
}

export async function getInsumo(id: string) {
  return db.query.productos.findFirst({
    where: and(eq(productos.id, id), eq(productos.esInsumo, true)),
    with: { proveedorHabitual: { columns: { nombre: true } } },
  });
}
export type Insumo = NonNullable<Awaited<ReturnType<typeof getInsumo>>>;

/** Insumos activos con stock y PPP para el formulario de compra en tanda. */
export async function listInsumosParaCompra() {
  return db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      unidad: productos.unidad,
      stock: productos.stockInsumo,
      ppp: productos.ppp,
    })
    .from(productos)
    .where(and(eq(productos.esInsumo, true), eq(productos.activo, true)))
    .orderBy(asc(productos.nombre));
}
export type InsumoCompraRow = Awaited<
  ReturnType<typeof listInsumosParaCompra>
>[number];

/** Receta vigente de un terminado (para "Sugerir compra"). */
export async function recetaParaSugerencia(productoId: string) {
  const r = await db.query.recetas.findFirst({
    where: and(
      eq(recetas.productoId, productoId),
      sql`${recetas.vigenteHasta} is null`,
    ),
    with: { lineas: true },
  });
  if (!r) return [];
  return r.lineas.map((l) => ({
    insumoId: l.insumoId,
    cantidadPorUnidad: Number(l.cantidadPorUnidad),
  }));
}

export async function listLotes() {
  return db.select().from(lotes).orderBy(asc(lotes.fecha));
}

export async function listBajas() {
  const rows = await db
    .select({
      id: bajasInsumo.id,
      fecha: bajasInsumo.fecha,
      insumo: productos.nombre,
      unidad: productos.unidad,
      cantidad: bajasInsumo.cantidad,
      motivo: bajasInsumo.motivo,
      monto: bajasInsumo.monto,
      lote: lotes.nombre,
      automatica: sql<boolean>`${bajasInsumo.ordenId} is not null`,
    })
    .from(bajasInsumo)
    .innerJoin(productos, eq(bajasInsumo.insumoId, productos.id))
    .leftJoin(lotes, eq(bajasInsumo.loteId, lotes.id))
    .orderBy(desc(bajasInsumo.fecha));
  return rows;
}

/** Conciliación de un lote: comprado vs. consumido por insumo (spec §3.2). */
export async function conciliacionLote(loteId: string) {
  const compras = await db
    .select({
      insumoId: compraInsumoLineas.insumoId,
      comprado: sql<number>`coalesce(sum(${compraInsumoLineas.cantidad}), 0)`,
    })
    .from(compraInsumoLineas)
    .innerJoin(comprasInsumo, eq(compraInsumoLineas.compraId, comprasInsumo.id))
    .where(eq(comprasInsumo.loteId, loteId))
    .groupBy(compraInsumoLineas.insumoId);

  const consumos = await db
    .select({
      insumoId: ordenLineas.insumoId,
      consumido: sql<number>`coalesce(sum(${ordenLineas.consumoReal}), 0)`,
    })
    .from(ordenLineas)
    .innerJoin(
      ordenesProduccion,
      eq(ordenLineas.ordenId, ordenesProduccion.id),
    )
    .where(
      and(
        eq(ordenesProduccion.loteId, loteId),
        eq(ordenesProduccion.estado, "cerrada"),
      ),
    )
    .groupBy(ordenLineas.insumoId);

  const consMap = new Map(consumos.map((c) => [c.insumoId, Number(c.consumido)]));
  const insumoIds = new Set([
    ...compras.map((c) => c.insumoId),
    ...consumos.map((c) => c.insumoId),
  ]);
  if (insumoIds.size === 0) return [];

  const info = await db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      unidad: productos.unidad,
      ppp: productos.ppp,
      reutilizable: productos.reutilizable,
    })
    .from(productos)
    .where(inArray(productos.id, [...insumoIds]));
  const infoMap = new Map(info.map((i) => [i.id, i]));

  return [...insumoIds].map((iid) => {
    const i = infoMap.get(iid)!;
    const comprado = Number(
      compras.find((c) => c.insumoId === iid)?.comprado ?? 0,
    );
    const consumido = consMap.get(iid) ?? 0;
    const sobrante = comprado - consumido;
    const ppp = Number(i.ppp);
    const perdida = !i.reutilizable && sobrante > 0 ? sobrante * ppp : 0;
    return {
      insumoId: iid,
      nombre: i.nombre,
      unidad: (i.unidad ?? "kg") as "kg" | "u",
      comprado,
      consumido,
      sobrante,
      reutilizable: i.reutilizable,
      perdida,
    };
  });
}
