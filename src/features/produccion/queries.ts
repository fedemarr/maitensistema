import "server-only";

import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  ordenesProduccion,
  preciosFabricacion,
  productos,
  recetas,
} from "@/db/schema";
import type { EstadoOrden } from "./schema";

/** Precio de fabricación vigente a una fecha (o el último). */
export async function precioFabricacionVigente(fecha: string) {
  const [row] = await db
    .select()
    .from(preciosFabricacion)
    .where(lte(preciosFabricacion.vigenteDesde, fecha))
    .orderBy(desc(preciosFabricacion.vigenteDesde))
    .limit(1);
  if (row) return row;
  const [any] = await db
    .select()
    .from(preciosFabricacion)
    .orderBy(desc(preciosFabricacion.vigenteDesde))
    .limit(1);
  return any ?? null;
}

export async function historialFabricacion() {
  return db
    .select()
    .from(preciosFabricacion)
    .orderBy(asc(preciosFabricacion.vigenteDesde));
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
