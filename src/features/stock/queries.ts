import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { variantes } from "@/db/schema";

export type EstadoStock = "ok" | "bajo" | "sin";

export type FilaStock = {
  varianteId: string;
  productoId: string;
  productoNombre: string;
  varianteNombre: string;
  rubro: string | null;
  stock: number;
  stockMin: number;
  costoPromedio: string;
  estado: EstadoStock;
  valorCosto: number;
};

export function estadoDe(stock: number, stockMin: number): EstadoStock {
  if (stock <= 0) return "sin";
  if (stockMin > 0 && stock < stockMin) return "bajo";
  return "ok";
}

const PRIORIDAD: Record<EstadoStock, number> = { bajo: 0, sin: 1, ok: 2 };

/** Todas las variantes activas con su relación de producto + rubro. */
export async function listStock(): Promise<FilaStock[]> {
  const rows = await db.query.variantes.findMany({
    where: eq(variantes.activo, true),
    with: {
      producto: {
        columns: { id: true, nombre: true },
        with: { rubro: { columns: { nombre: true } } },
      },
    },
    orderBy: (v) => [asc(v.nombre)],
  });

  const filas: FilaStock[] = rows.map((v) => {
    const stock = v.stock;
    const stockMin = v.stockMin;
    const costo = Number(v.costoPromedio) || 0;
    return {
      varianteId: v.id,
      productoId: v.producto.id,
      productoNombre: v.producto.nombre,
      varianteNombre: v.nombre,
      rubro: v.producto.rubro?.nombre ?? null,
      stock,
      stockMin,
      costoPromedio: v.costoPromedio,
      estado: estadoDe(stock, stockMin),
      valorCosto: stock * costo,
    };
  });

  // Orden por defecto: bajo mínimo primero, luego sin stock, luego el resto.
  filas.sort((a, b) => {
    if (PRIORIDAD[a.estado] !== PRIORIDAD[b.estado])
      return PRIORIDAD[a.estado] - PRIORIDAD[b.estado];
    return a.productoNombre.localeCompare(b.productoNombre) ||
      a.varianteNombre.localeCompare(b.varianteNombre);
  });

  return filas;
}