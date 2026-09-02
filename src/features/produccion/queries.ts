import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { ordenesProduccion } from "@/db/schema";
import { getRecetaActiva } from "@/features/recetas/queries";
import { consumoInsumo, type EstadoOrden } from "./schema";

export type OrdenListItem = {
  id: string;
  fecha: string;
  cantidad: number;
  estado: EstadoOrden;
  terminadoLabel: string;
  creador: string | null;
};

export async function listOrdenes(): Promise<OrdenListItem[]> {
  const rows = await db.query.ordenesProduccion.findMany({
    with: {
      varianteTerminado: {
        with: { producto: { columns: { nombre: true } } },
      },
      creador: { columns: { nombre: true } },
    },
    orderBy: (o) => [desc(o.fecha), desc(o.createdAt)],
  });

  return rows.map((o) => ({
    id: o.id,
    fecha: o.fecha,
    cantidad: o.cantidad,
    estado: o.estado,
    terminadoLabel: `${o.varianteTerminado.producto.nombre} — ${o.varianteTerminado.nombre}`,
    creador: o.creador?.nombre ?? null,
  }));
}

export type RequerimientoInsumo = {
  varianteInsumoId: string;
  insumoLabel: string;
  requerido: number;
  disponible: number;
  costoPromedio: string;
  falta: number;
};

export type OrdenDetalle = {
  id: string;
  fecha: string;
  cantidad: number;
  estado: EstadoOrden;
  notas: string | null;
  terminadoLabel: string;
  varianteTerminadoId: string;
  movimientoId: string | null;
  tieneReceta: boolean;
  requerimientos: RequerimientoInsumo[];
  costoEstimado: number;
  puedeCompletar: boolean;
};

export async function getOrden(id: string): Promise<OrdenDetalle | null> {
  const o = await db.query.ordenesProduccion.findFirst({
    where: eq(ordenesProduccion.id, id),
    with: {
      varianteTerminado: {
        with: { producto: { columns: { nombre: true } } },
      },
    },
  });
  if (!o) return null;

  const receta = await getRecetaActiva(o.varianteTerminadoId);

  const requerimientos: RequerimientoInsumo[] = (receta?.items ?? []).map(
    (it) => {
      const requerido = consumoInsumo(
        Number(it.cantidad),
        Number(it.mermaPct),
        receta!.rinde,
        o.cantidad,
      );
      return {
        varianteInsumoId: it.varianteInsumoId,
        insumoLabel: it.insumoLabel,
        requerido,
        disponible: it.stockInsumo,
        costoPromedio: it.costoPromedio,
        falta: Math.max(0, requerido - it.stockInsumo),
      };
    },
  );

  const costoEstimado = requerimientos.reduce(
    (a, r) => a + r.requerido * Number(r.costoPromedio),
    0,
  );

  return {
    id: o.id,
    fecha: o.fecha,
    cantidad: o.cantidad,
    estado: o.estado,
    notas: o.notas,
    terminadoLabel: `${o.varianteTerminado.producto.nombre} — ${o.varianteTerminado.nombre}`,
    varianteTerminadoId: o.varianteTerminadoId,
    movimientoId: o.movimientoId,
    tieneReceta: Boolean(receta),
    requerimientos,
    costoEstimado,
    puedeCompletar:
      Boolean(receta) &&
      (o.estado === "borrador" || o.estado === "en_proceso") &&
      requerimientos.every((r) => r.falta === 0),
  };
}
