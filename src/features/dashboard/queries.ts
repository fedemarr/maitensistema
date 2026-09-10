import "server-only";

import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  ccMovimientos,
  consignaciones,
  movimientoItems,
  movimientos,
  productos,
  stockLotes,
} from "@/db/schema";

export type ResumenInicio = {
  alertasStock: number;
  consignacionesVencidas: number;
  porCobrar: number;
  mes: { unidades: number; ingresos: number; bruto: number };
};

/** Números de la pantalla de inicio. Consultas livianas, en paralelo. */
export async function resumenInicio(): Promise<ResumenInicio> {
  const hoy = new Date().toISOString().slice(0, 10);
  const desdeMes = `${hoy.slice(0, 7)}-01`;

  const [stockRows, venc, cobrar, ventasMes] = await Promise.all([
    // Depósito por producto terminado vs. su mínimo.
    db
      .select({
        minimo: productos.stockMinimo,
        deposito: sql<number>`coalesce(sum(${stockLotes.unidadesEnDeposito}), 0)`,
      })
      .from(productos)
      .leftJoin(stockLotes, eq(stockLotes.productoId, productos.id))
      .where(eq(productos.esInsumo, false))
      .groupBy(productos.id, productos.stockMinimo),

    db
      .select({ n: sql<number>`count(*)::int` })
      .from(consignaciones)
      .where(
        and(
          lte(consignaciones.vence, hoy),
          sql`${consignaciones.entregadas} - ${consignaciones.vendidas} - ${consignaciones.devueltas} > 0`,
        ),
      ),

    db
      .select({
        debe: sql<number>`coalesce(sum(${ccMovimientos.debe}), 0)`,
        haber: sql<number>`coalesce(sum(${ccMovimientos.haber}), 0)`,
      })
      .from(ccMovimientos)
      .where(eq(ccMovimientos.entidadTipo, "cliente")),

    db
      .select({
        unidades: sql<number>`coalesce(sum(abs(${movimientoItems.cantidad})), 0)`,
        ingresos: sql<number>`coalesce(sum(${movimientoItems.ingresoNeto}), 0)`,
        costo: sql<number>`coalesce(sum(${movimientoItems.costo}), 0)`,
      })
      .from(movimientoItems)
      .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
      .where(
        and(
          sql`${movimientos.tipo} in ('venta', 'venta_consignacion')`,
          gte(movimientos.fecha, desdeMes),
          lte(movimientos.fecha, hoy),
        ),
      ),
  ]);

  const alertasStock = stockRows.filter(
    (r) => Number(r.deposito) <= r.minimo,
  ).length;
  const ing = Number(ventasMes[0]?.ingresos ?? 0);
  const cmv = Number(ventasMes[0]?.costo ?? 0);

  return {
    alertasStock,
    consignacionesVencidas: venc[0]?.n ?? 0,
    porCobrar: Math.max(
      0,
      Number(cobrar[0]?.debe ?? 0) - Number(cobrar[0]?.haber ?? 0),
    ),
    mes: {
      unidades: Number(ventasMes[0]?.unidades ?? 0),
      ingresos: ing,
      bruto: ing - cmv,
    },
  };
}
