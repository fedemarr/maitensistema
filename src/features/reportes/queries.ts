import "server-only";

import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  movimientoItems,
  movimientos,
  productos,
  variantes,
} from "@/db/schema";
import type { TipoMovimiento } from "@/features/movimientos/schema";

const TIPOS_SALIDA = new Set([
  "venta",
  "consignacion",
  "canje",
  "presentacion",
  "regalo",
  "rotura",
] as TipoMovimiento[]);

type ItemPeriodo = {
  productoId: string;
  productoNombre: string;
  cantidad: number;
  precioUnit: number;
  costoUnit: number;
  tipo: TipoMovimiento;
};

export type FilaProductoReporte = {
  productoId: string;
  productoNombre: string;
  unidadesVendidas: number;
  ingresos: number;
  cmv: number;
  resultadoBruto: number;
  margen: number | null;
  stockActual: number;
  promedioVentaMensual: number;
  mesesStock: number | null;
  pctConsumido: number | null;
};

export type FilaDesglose = {
  tipo: TipoMovimiento;
  unidades: number;
  valorCosto: number;
};

export type ReporteMensual = {
  desde: string;
  hasta: string;
  totalUnidades: number;
  totalIngresos: number;
  totalCmv: number;
  totalBruto: number;
  totalMargen: number | null;
  productos: FilaProductoReporte[];
  desglose: FilaDesglose[];
};

export async function reporteMensual(
  desde: string,
  hasta: string,
): Promise<ReporteMensual> {
  const fechas = and(
    gte(movimientos.fecha, desde),
    lte(movimientos.fecha, hasta),
  );

  const items = await db
    .select({
      productoId: productos.id,
      productoNombre: productos.nombre,
      cantidad: movimientoItems.cantidad,
      precioUnit: movimientoItems.precioUnit,
      costoUnit: movimientoItems.costoUnit,
      tipo: movimientos.tipo,
    })
    .from(movimientoItems)
    .innerJoin(variantes, eq(movimientoItems.varianteId, variantes.id))
    .innerJoin(productos, eq(variantes.productoId, productos.id))
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .where(fechas);

  const itemsN: ItemPeriodo[] = items.map((i) => ({
    ...i,
    precioUnit: Number(i.precioUnit),
    costoUnit: Number(i.costoUnit),
    cantidad: i.cantidad,
  }));

  // Stock actual por producto (variantes activas).
  const stockRows = await db
    .select({
      productoId: productos.id,
      stock: sql<number>`coalesce(sum(${variantes.stock}), 0)`,
    })
    .from(variantes)
    .innerJoin(productos, eq(variantes.productoId, productos.id))
    .where(eq(variantes.activo, true))
    .groupBy(productos.id);
  const stockPorProducto = new Map(
    stockRows.map((r) => [r.productoId, Number(r.stock)]),
  );

  // Venta total histórica por producto (para el promedio mensual).
  const ventaTotal = await db
    .select({
      productoId: productos.id,
      unidades: sql<number>`sum(cast(${movimientoItems.cantidad} as int))`,
    })
    .from(movimientoItems)
    .innerJoin(variantes, eq(movimientoItems.varianteId, variantes.id))
    .innerJoin(productos, eq(variantes.productoId, productos.id))
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .where(eq(movimientos.tipo, "venta"))
    .groupBy(productos.id);
  const ventaPorProducto = new Map(
    ventaTotal.map((r) => [r.productoId, Number(r.unidades)]),
  );

  const [minFila] = await db
    .select({ min: sql<string>`min(${movimientos.fecha})` })
    .from(movimientos)
    .where(eq(movimientos.tipo, "venta"));
  const mesesTranscurridos = minFila?.min
    ? Math.max(
        1,
        Math.round(
          (new Date().getTime() - new Date(minFila.min).getTime()) /
            (1000 * 60 * 60 * 24 * 30),
        ),
      )
    : 1;

  // Agregación por producto y desglose por tipo.
  const porProducto = new Map<
    string,
    {
      productoId: string;
      productoNombre: string;
      unidadesVendidas: number;
      ingresos: number;
      cmv: number;
      salidas: number;
      ingresosPeriodo: number;
      ajustesNeto: number;
    }
  >();
  const desgloseMap = new Map<TipoMovimiento, { unidades: number; valorCosto: number }>();

  for (const i of itemsN) {
    const p =
      porProducto.get(i.productoId) ??
      {
        productoId: i.productoId,
        productoNombre: i.productoNombre,
        unidadesVendidas: 0,
        ingresos: 0,
        cmv: 0,
        salidas: 0,
        ingresosPeriodo: 0,
        ajustesNeto: 0,
      };

    if (i.tipo === "venta") {
      p.unidadesVendidas += i.cantidad;
      p.ingresos += i.precioUnit * i.cantidad;
      p.cmv += i.costoUnit * i.cantidad;
      p.salidas += i.cantidad;
    } else if (i.tipo === "ingreso") {
      p.ingresosPeriodo += i.cantidad;
    } else if (i.tipo === "ajuste") {
      p.ajustesNeto += i.cantidad;
    } else if (TIPOS_SALIDA.has(i.tipo)) {
      p.salidas += i.cantidad;
    }

    porProducto.set(i.productoId, p);

    const d = desgloseMap.get(i.tipo) ?? { unidades: 0, valorCosto: 0 };
    d.unidades += i.cantidad;
    d.valorCosto += i.costoUnit * i.cantidad;
    desgloseMap.set(i.tipo, d);
  }

  const productosFinales = [...porProducto.values()].map((p) => {
    const stockActual = stockPorProducto.get(p.productoId) ?? 0;
    const promedioVentaMensual = (ventaPorProducto.get(p.productoId) ?? 0) / mesesTranscurridos;
    const mesesStock =
      promedioVentaMensual > 0 ? stockActual / promedioVentaMensual : null;
    const stockInicial =
      stockActual - p.ingresosPeriodo + p.salidas - p.ajustesNeto;
    const disponibles =
      stockInicial + p.ingresosPeriodo;
    const pctConsumido =
      disponibles > 0 ? (p.salidas / disponibles) * 100 : null;

    const resultadoBruto = p.ingresos - p.cmv;
    return {
      productoId: p.productoId,
      productoNombre: p.productoNombre,
      unidadesVendidas: p.unidadesVendidas,
      ingresos: p.ingresos,
      cmv: p.cmv,
      resultadoBruto,
      margen: p.ingresos > 0 ? (resultadoBruto / p.ingresos) * 100 : null,
      stockActual,
      promedioVentaMensual,
      mesesStock,
      pctConsumido,
    };
  });

  productosFinales.sort((a, b) =>
    a.productoNombre.localeCompare(b.productoNombre),
  );

  const totalUnidades = productosFinales.reduce((a, p) => a + p.unidadesVendidas, 0);
  const totalIngresos = productosFinales.reduce((a, p) => a + p.ingresos, 0);
  const totalCmv = productosFinales.reduce((a, p) => a + p.cmv, 0);
  const totalBruto = totalIngresos - totalCmv;

  const desglose = [...desgloseMap.entries()]
    .map(([tipo, d]) => ({ tipo, ...d }))
    .sort((a, b) => a.tipo.localeCompare(b.tipo));

  return {
    desde,
    hasta,
    totalUnidades,
    totalIngresos,
    totalCmv,
    totalBruto,
    totalMargen: totalIngresos > 0 ? (totalBruto / totalIngresos) * 100 : null,
    productos: productosFinales,
    desglose,
  };
}