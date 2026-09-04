import "server-only";

import { asc, desc } from "drizzle-orm";

import { db } from "@/db";
import { costosFijos } from "@/db/schema";
import type { CategoriaCostoFijo } from "./schema";

export type CostoFijoRow = {
  id: string;
  concepto: string;
  categoria: CategoriaCostoFijo;
  montoMensual: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
  notas: string | null;
};

export async function listCostosFijos(): Promise<CostoFijoRow[]> {
  return db
    .select()
    .from(costosFijos)
    .orderBy(asc(costosFijos.concepto), desc(costosFijos.vigenteDesde));
}

function vigenteEnMes(
  r: { vigenteDesde: string; vigenteHasta: string | null },
  desde: string,
  hasta: string,
) {
  return r.vigenteDesde <= hasta && (r.vigenteHasta == null || r.vigenteHasta >= desde);
}

function rangoMes(mes: string) {
  const desde = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const hasta = new Date(y, m, 0).toISOString().slice(0, 10);
  return { desde, hasta };
}

/** Total y desglose por categoría de los costos fijos vigentes en un mes (YYYY-MM). */
export async function costosFijosDelMes(mes: string) {
  const { desde, hasta } = rangoMes(mes);
  const rows = await db.select().from(costosFijos);
  const vigentes = rows.filter((r) => vigenteEnMes(r, desde, hasta));
  const total = vigentes.reduce((a, r) => a + Number(r.montoMensual), 0);
  const porCategoria = new Map<string, number>();
  for (const r of vigentes) {
    porCategoria.set(
      r.categoria,
      (porCategoria.get(r.categoria) ?? 0) + Number(r.montoMensual),
    );
  }
  return { total, porCategoria, items: vigentes };
}

/** Total de costos fijos vigentes, mes por mes, en una sola consulta. */
export async function costosFijosPorMeses(
  meses: string[],
): Promise<Map<string, number>> {
  const rows = await db.select().from(costosFijos);
  const out = new Map<string, number>();
  for (const mes of meses) {
    const { desde, hasta } = rangoMes(mes);
    const total = rows
      .filter((r) => vigenteEnMes(r, desde, hasta))
      .reduce((a, r) => a + Number(r.montoMensual), 0);
    out.set(mes, total);
  }
  return out;
}
