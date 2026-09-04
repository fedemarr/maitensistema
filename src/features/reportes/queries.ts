import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  bajasInsumo,
  movimientoItems,
  movimientos,
  ordenesProduccion,
  productos,
  stockLotes,
} from "@/db/schema";

export type MesEERR = {
  mes: string; // YYYY-MM
  unidades: number;
  ingresos: number;
  cmv: number;
  bruto: number;
  margen: number | null;
  desvios: number; // ahorro positivo
  coBranding: number;
  salidasNoVenta: number;
  perdidaInsumos: number;
  antesCostosFijos: number;
};

export type FilaProducto = {
  producto: string;
  unidades: number;
  ingresos: number;
  cmv: number;
  bruto: number;
  margen: number | null;
  stock: number;
  mesesStock: number | null;
  pctConsumido: number | null;
};

export type FilaTipo = { tipo: string; unidades: number; valorCosto: number };

export type Reporte = {
  meses: MesEERR[];
  mesActual: string;
  porProducto: FilaProducto[];
  porTipo: FilaTipo[];
};

function calcMes(base: Omit<MesEERR, "bruto" | "margen" | "antesCostosFijos">): MesEERR {
  const bruto = base.ingresos - base.cmv;
  const antes =
    bruto +
    base.desvios -
    base.coBranding -
    base.salidasNoVenta -
    base.perdidaInsumos;
  return {
    ...base,
    bruto,
    margen: base.ingresos ? bruto / base.ingresos : null,
    antesCostosFijos: antes,
  };
}

/** Reporte económico completo. `mes` = YYYY-MM (default: último con datos). */
export async function getReporte(mes?: string): Promise<Reporte> {
  const mesExpr = sql<string>`to_char(${movimientos.fecha}, 'YYYY-MM')`;

  // Ventas por mes.
  const ventas = await db
    .select({
      mes: mesExpr,
      unidades: sql<number>`coalesce(sum(abs(${movimientoItems.cantidad})), 0)`,
      ingresos: sql<number>`coalesce(sum(${movimientoItems.ingresoNeto}), 0)`,
      cmv: sql<number>`coalesce(sum(${movimientoItems.costo}), 0)`,
    })
    .from(movimientoItems)
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .where(sql`${movimientos.tipo} in ('venta', 'venta_consignacion')`)
    .groupBy(mesExpr);

  // Co-branding y salidas no-venta por mes.
  const otros = await db
    .select({
      mes: mesExpr,
      cobrand: sql<number>`coalesce(sum(case when ${movimientos.tipo} = 'co_branding' then ${movimientoItems.costo} else 0 end), 0)`,
      noVenta: sql<number>`coalesce(sum(case when ${movimientos.tipo} in ('canje','presentacion','regalo','rotura','sorteo','tester','influencer','prueba') then ${movimientoItems.costo}
        when ${movimientos.tipo} = 'ajuste' and ${movimientoItems.cantidad} < 0 then ${movimientoItems.costo}
        else 0 end), 0)`,
    })
    .from(movimientoItems)
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .groupBy(mesExpr);

  // Desvíos de producción (órdenes cerradas) por mes de cierre.
  const desv = await db
    .select({
      mes: sql<string>`to_char(${ordenesProduccion.fechaCierre}, 'YYYY-MM')`,
      desvMp: sql<number>`coalesce(sum(${ordenesProduccion.desvioMp}), 0)`,
      desvFab: sql<number>`coalesce(sum(${ordenesProduccion.desvioFabricacion}), 0)`,
    })
    .from(ordenesProduccion)
    .where(eq(ordenesProduccion.estado, "cerrada"))
    .groupBy(sql`to_char(${ordenesProduccion.fechaCierre}, 'YYYY-MM')`);

  // Pérdida por insumos (bajas) por mes.
  const bajas = await db
    .select({
      mes: sql<string>`to_char(${bajasInsumo.fecha}, 'YYYY-MM')`,
      monto: sql<number>`coalesce(sum(${bajasInsumo.monto}), 0)`,
    })
    .from(bajasInsumo)
    .groupBy(sql`to_char(${bajasInsumo.fecha}, 'YYYY-MM')`);

  const mesesSet = new Set<string>([
    ...ventas.map((v) => v.mes),
    ...otros.map((o) => o.mes),
    ...desv.map((d) => d.mes).filter(Boolean),
    ...bajas.map((b) => b.mes).filter(Boolean),
  ]);
  if (mesesSet.size === 0) {
    mesesSet.add(new Date().toISOString().slice(0, 7));
  }
  const mesesOrdenados = [...mesesSet].sort();

  const vMap = new Map(ventas.map((v) => [v.mes, v]));
  const oMap = new Map(otros.map((o) => [o.mes, o]));
  const dMap = new Map(desv.map((d) => [d.mes, d]));
  const bMap = new Map(bajas.map((b) => [b.mes, b]));

  const meses: MesEERR[] = mesesOrdenados.map((m) => {
    const v = vMap.get(m);
    const o = oMap.get(m);
    const d = dMap.get(m);
    const b = bMap.get(m);
    return calcMes({
      mes: m,
      unidades: Number(v?.unidades ?? 0),
      ingresos: Number(v?.ingresos ?? 0),
      cmv: Number(v?.cmv ?? 0),
      desvios: -(Number(d?.desvMp ?? 0) + Number(d?.desvFab ?? 0)),
      coBranding: Number(o?.cobrand ?? 0),
      salidasNoVenta: Number(o?.noVenta ?? 0),
      perdidaInsumos: Number(b?.monto ?? 0),
    });
  });

  const mesActual =
    mes && mesesOrdenados.includes(mes)
      ? mes
      : mesesOrdenados[mesesOrdenados.length - 1];

  // ── Detalle del mes elegido ──
  const desdeIso = `${mesActual}-01`;
  const [y, mm] = mesActual.split("-").map(Number);
  const hastaIso = new Date(y, mm, 0).toISOString().slice(0, 10);

  const ventasProd = await db
    .select({
      producto: productos.nombre,
      productoId: productos.id,
      unidades: sql<number>`coalesce(sum(abs(${movimientoItems.cantidad})), 0)`,
      ingresos: sql<number>`coalesce(sum(${movimientoItems.ingresoNeto}), 0)`,
      cmv: sql<number>`coalesce(sum(${movimientoItems.costo}), 0)`,
    })
    .from(movimientoItems)
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .innerJoin(productos, eq(movimientoItems.productoId, productos.id))
    .where(
      sql`${movimientos.tipo} in ('venta','venta_consignacion') and ${movimientos.fecha} between ${desdeIso} and ${hastaIso}`,
    )
    .groupBy(productos.id, productos.nombre);

  // Stock actual por producto.
  const stockRows = await db
    .select({
      productoId: stockLotes.productoId,
      u: sql<number>`coalesce(sum(${stockLotes.unidadesEnDeposito}), 0)`,
    })
    .from(stockLotes)
    .groupBy(stockLotes.productoId);
  const stockMap = new Map(stockRows.map((s) => [s.productoId, Number(s.u)]));

  const todosProd = await db
    .select({ id: productos.id, nombre: productos.nombre })
    .from(productos)
    .where(eq(productos.esInsumo, false));

  const vpMap = new Map(ventasProd.map((v) => [v.productoId, v]));
  const porProducto: FilaProducto[] = todosProd.map((p) => {
    const v = vpMap.get(p.id);
    const unidades = Number(v?.unidades ?? 0);
    const ingresos = Number(v?.ingresos ?? 0);
    const cmv = Number(v?.cmv ?? 0);
    const stock = stockMap.get(p.id) ?? 0;
    return {
      producto: p.nombre,
      unidades,
      ingresos,
      cmv,
      bruto: ingresos - cmv,
      margen: ingresos ? (ingresos - cmv) / ingresos : null,
      stock,
      mesesStock: unidades > 0 ? stock / unidades : null,
      pctConsumido: unidades + stock > 0 ? unidades / (unidades + stock) : null,
    };
  });

  // Desglose por tipo del mes.
  const porTipoRows = await db
    .select({
      tipo: movimientos.tipo,
      unidades: sql<number>`coalesce(sum(abs(${movimientoItems.cantidad})), 0)`,
      valorCosto: sql<number>`coalesce(sum(${movimientoItems.costo}), 0)`,
    })
    .from(movimientoItems)
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .where(sql`${movimientos.fecha} between ${desdeIso} and ${hastaIso}`)
    .groupBy(movimientos.tipo);

  return {
    meses,
    mesActual,
    porProducto,
    porTipo: porTipoRows.map((t) => ({
      tipo: t.tipo,
      unidades: Number(t.unidades),
      valorCosto: Number(t.valorCosto),
    })),
  };
}
