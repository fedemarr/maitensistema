"use server";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  movimientoItems,
  movimientos,
  productos,
  variantes,
} from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

export type DiferenciaStock = {
  varianteId: string;
  productoNombre: string;
  varianteNombre: string;
  stockReal: number;
  stockEsperado: number;
  diferencia: number;
};

/**
 * Recalcula, por variante, el stock esperado a partir de la suma de los
 * deltas de `movimiento_items` y lo compara con `variantes.stock`. Solo
 * reporta diferencias: no corrige nada (red de seguridad del invariante 6).
 */
export async function verificarStock() {
  const user = await requireRole(["admin"]);

  const grupos = await db
    .select({
      varianteId: movimientoItems.varianteId,
      esperado: sql<number>`
        sum(case
          when ${movimientos.tipo} in ('ingreso', 'devolucion_consignacion')
            then ${movimientoItems.cantidad}
          when ${movimientos.tipo} = 'ajuste'
            then ${movimientoItems.cantidad}
          when ${movimientos.tipo} = 'produccion'
            then case when ${productos.esInsumo}
                   then -${movimientoItems.cantidad}
                   else ${movimientoItems.cantidad} end
          else -${movimientoItems.cantidad}
        end)
      `,
    })
    .from(movimientoItems)
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .innerJoin(variantes, eq(movimientoItems.varianteId, variantes.id))
    .innerJoin(productos, eq(variantes.productoId, productos.id))
    .groupBy(movimientoItems.varianteId);

  const variantesReales = await db.query.variantes.findMany({
    with: { producto: { columns: { nombre: true } } },
  });
  const realPorId = new Map(variantesReales.map((v) => [v.id, v]));

  const diferencias: DiferenciaStock[] = [];
  for (const g of grupos) {
    const real = realPorId.get(g.varianteId);
    if (!real) continue;
    const esperado = Number(g.esperado);
    if (esperado !== real.stock) {
      diferencias.push({
        varianteId: real.id,
        productoNombre: real.producto.nombre,
        varianteNombre: real.nombre,
        stockReal: real.stock,
        stockEsperado: esperado,
        diferencia: esperado - real.stock,
      });
    }
  }

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "verificacion-stock",
    datos: { revisados: grupos.length, diferencias: diferencias.length },
  });

  return {
    ok: true as const,
    revisados: grupos.length,
    diferencias,
  };
}