"use server";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  movimientoItemLotes,
  movimientoItems,
  movimientos,
  productos,
} from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

export type DiferenciaStock = {
  producto: string;
  lote: string;
  materializado: number;
  segunMovimientos: number;
  diferencia: number;
};

/**
 * Chequeo de salud: compara el stock por lote materializado (`stock_lotes`)
 * contra la suma de los movimientos por lote. La carga inicial de stock se
 * considera baseline; las diferencias que reporta son drift del materializado.
 */
export async function verificarStock() {
  const user = await requireRole(["admin"]);

  const movs = await db
    .select({
      productoId: movimientoItems.productoId,
      loteId: movimientoItemLotes.loteId,
      delta: sql<number>`
        sum(${movimientoItemLotes.cantidad} * case
          when ${movimientos.tipo} in ('produccion', 'devolucion_consignacion') then 1
          else -1
        end)
      `,
    })
    .from(movimientoItemLotes)
    .innerJoin(
      movimientoItems,
      eq(movimientoItemLotes.itemId, movimientoItems.id),
    )
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .groupBy(movimientoItems.productoId, movimientoItemLotes.loteId);

  const deltaMap = new Map(
    movs.map((m) => [`${m.productoId}:${m.loteId}`, Number(m.delta)]),
  );

  const materializado = await db.query.stockLotes.findMany({
    with: {
      producto: { columns: { nombre: true } },
      lote: { columns: { nombre: true } },
    },
  });

  const diferencias: DiferenciaStock[] = [];
  for (const s of materializado) {
    const segun = deltaMap.get(`${s.productoId}:${s.loteId}`) ?? 0;
    // Sin movimientos, `segun` es 0 y el materializado es la carga inicial:
    // solo reportamos si HAY movimientos y no cuadran.
    if (segun !== 0 && segun !== s.unidadesEnDeposito) {
      diferencias.push({
        producto: s.producto.nombre,
        lote: s.lote.nombre,
        materializado: s.unidadesEnDeposito,
        segunMovimientos: segun,
        diferencia: segun - s.unidadesEnDeposito,
      });
    }
  }

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "verificacion-stock",
    datos: { revisados: materializado.length, diferencias: diferencias.length },
  });

  return {
    ok: true as const,
    revisados: materializado.length,
    diferencias,
  };
}

/** Ajusta el stock mínimo de un producto (spec §3.4: editable acá). */
export async function setStockMinimo(id: string, minimo: number) {
  const user = await requireRole(["admin", "ventas"]);
  const min = Math.max(0, Math.trunc(minimo));
  await db
    .update(productos)
    .set({ stockMinimo: min })
    .where(eq(productos.id, id));
  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "producto",
    entidadId: id,
    datos: { stockMinimo: min },
  });
  return { ok: true as const };
}
