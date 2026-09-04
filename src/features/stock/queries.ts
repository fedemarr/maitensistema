import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { consignaciones, productos } from "@/db/schema";

export type EstadoStock = "ok" | "reponer" | "sin";

export type LoteDeposito = { lote: string; unidades: number };

export type StockProducto = {
  id: string;
  nombre: string;
  sku: string;
  presentacion: string | null;
  ppp: number;
  minimo: number;
  enDeposito: number;
  enConsignacion: number;
  totalPropio: number;
  estado: EstadoStock;
  valorACosto: number;
  lotes: LoteDeposito[];
};

export function estadoDe(enDeposito: number, minimo: number): EstadoStock {
  if (enDeposito <= 0) return "sin";
  if (minimo > 0 && enDeposito <= minimo) return "reponer";
  return "ok";
}

/** Stock de producto terminado por producto y lote (spec §3.4). */
export async function listStockProductos(): Promise<StockProducto[]> {
  const prods = await db.query.productos.findMany({
    where: eq(productos.esInsumo, false),
    with: {
      stockLotes: {
        with: { lote: { columns: { nombre: true } } },
      },
    },
    orderBy: (p) => [asc(p.nombre)],
  });

  // Pendientes de consignación por producto.
  const consig = await db
    .select({
      productoId: consignaciones.productoId,
      entregadas: consignaciones.entregadas,
      vendidas: consignaciones.vendidas,
      devueltas: consignaciones.devueltas,
    })
    .from(consignaciones);
  const pendPorProducto = new Map<string, number>();
  for (const c of consig) {
    const pend = c.entregadas - c.vendidas - c.devueltas;
    pendPorProducto.set(
      c.productoId,
      (pendPorProducto.get(c.productoId) ?? 0) + Math.max(0, pend),
    );
  }

  return prods.map((p) => {
    const lotes = p.stockLotes
      .filter((s) => s.unidadesEnDeposito !== 0)
      .map((s) => ({ lote: s.lote.nombre, unidades: s.unidadesEnDeposito }))
      .sort((a, b) => a.lote.localeCompare(b.lote, "es", { numeric: true }));
    const enDeposito = lotes.reduce((a, l) => a + l.unidades, 0);
    const enConsignacion = pendPorProducto.get(p.id) ?? 0;
    const totalPropio = enDeposito + enConsignacion;
    const ppp = Number(p.ppp);
    return {
      id: p.id,
      nombre: p.nombre,
      sku: p.sku,
      presentacion: p.presentacion,
      ppp,
      minimo: p.stockMinimo,
      enDeposito,
      enConsignacion,
      totalPropio,
      estado: estadoDe(enDeposito, p.stockMinimo),
      valorACosto: totalPropio * ppp,
      lotes,
    };
  });
}

export type IndicadoresStock = {
  enDeposito: number;
  enConsignacion: number;
  bajoMinimo: number;
  valorInventario: number;
};

export function indicadoresStock(rows: StockProducto[]): IndicadoresStock {
  return {
    enDeposito: rows.reduce((a, r) => a + r.enDeposito, 0),
    enConsignacion: rows.reduce((a, r) => a + r.enConsignacion, 0),
    bajoMinimo: rows.filter((r) => r.estado !== "ok").length,
    valorInventario: rows.reduce((a, r) => a + r.valorACosto, 0),
  };
}
