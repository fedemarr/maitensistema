import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { ccMovimientos } from "@/db/schema";
import type { OrigenCc } from "./schema";

type EntidadTipo = "cliente" | "proveedor";

/** Saldo de una entidad. Cliente: Σdebe − Σhaber (+ = nos debe). Proveedor: Σhaber − Σdebe (+ = les debemos). */
export async function saldoEntidad(
  tipo: EntidadTipo,
  entidadId: string,
): Promise<number> {
  const [row] = await db
    .select({
      debe: sql<number>`coalesce(sum(${ccMovimientos.debe}), 0)`,
      haber: sql<number>`coalesce(sum(${ccMovimientos.haber}), 0)`,
    })
    .from(ccMovimientos)
    .where(
      and(
        eq(ccMovimientos.entidadTipo, tipo),
        eq(ccMovimientos.entidadId, entidadId),
      ),
    );
  const debe = Number(row?.debe ?? 0);
  const haber = Number(row?.haber ?? 0);
  return tipo === "cliente" ? debe - haber : haber - debe;
}

/** Saldos de todas las entidades de un tipo, en una sola consulta (para listados). */
export async function saldosPorTipo(
  tipo: EntidadTipo,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      entidadId: ccMovimientos.entidadId,
      debe: sql<number>`coalesce(sum(${ccMovimientos.debe}), 0)`,
      haber: sql<number>`coalesce(sum(${ccMovimientos.haber}), 0)`,
    })
    .from(ccMovimientos)
    .where(eq(ccMovimientos.entidadTipo, tipo))
    .groupBy(ccMovimientos.entidadId);
  const out = new Map<string, number>();
  for (const r of rows) {
    const debe = Number(r.debe);
    const haber = Number(r.haber);
    out.set(r.entidadId, tipo === "cliente" ? debe - haber : haber - debe);
  }
  return out;
}

export type CcMovimientoRow = {
  id: string;
  fecha: string;
  concepto: string;
  debe: string;
  haber: string;
  origen: OrigenCc;
  medioPago: string | null;
};

export async function historialCc(
  tipo: EntidadTipo,
  entidadId: string,
): Promise<CcMovimientoRow[]> {
  const rows = await db
    .select({
      id: ccMovimientos.id,
      fecha: ccMovimientos.fecha,
      concepto: ccMovimientos.concepto,
      debe: ccMovimientos.debe,
      haber: ccMovimientos.haber,
      origen: ccMovimientos.origen,
      medioPago: ccMovimientos.medioPago,
    })
    .from(ccMovimientos)
    .where(
      and(
        eq(ccMovimientos.entidadTipo, tipo),
        eq(ccMovimientos.entidadId, entidadId),
      ),
    )
    .orderBy(desc(ccMovimientos.fecha), desc(ccMovimientos.createdAt));
  return rows;
}
