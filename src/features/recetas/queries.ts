import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { productos, recetas, variantes } from "@/db/schema";

export type RecetaItemDetalle = {
  id: string;
  varianteInsumoId: string;
  insumoLabel: string;
  cantidad: string;
  mermaPct: string;
  costoPromedio: string;
  stockInsumo: number;
};

export type RecetaActiva = {
  id: string;
  varianteTerminadoId: string;
  rinde: number;
  notas: string | null;
  items: RecetaItemDetalle[];
};

/** Receta activa de una variante de producto terminado, con detalle de insumos. */
export async function getRecetaActiva(
  varianteTerminadoId: string,
): Promise<RecetaActiva | null> {
  const receta = await db.query.recetas.findFirst({
    where: and(
      eq(recetas.varianteTerminadoId, varianteTerminadoId),
      eq(recetas.activa, true),
    ),
    with: {
      items: {
        with: {
          varianteInsumo: {
            with: { producto: { columns: { nombre: true } } },
          },
        },
      },
    },
  });
  if (!receta) return null;

  return {
    id: receta.id,
    varianteTerminadoId: receta.varianteTerminadoId,
    rinde: receta.rinde,
    notas: receta.notas,
    items: receta.items.map((it) => ({
      id: it.id,
      varianteInsumoId: it.varianteInsumoId,
      insumoLabel: `${it.varianteInsumo.producto.nombre} — ${it.varianteInsumo.nombre}`,
      cantidad: it.cantidad,
      mermaPct: it.mermaPct,
      costoPromedio: it.varianteInsumo.costoPromedio,
      stockInsumo: it.varianteInsumo.stock,
    })),
  };
}

/** ¿La variante terminada tiene receta activa? (para habilitar producción). */
export async function tieneReceta(
  varianteTerminadoId: string,
): Promise<boolean> {
  const r = await db
    .select({ id: recetas.id })
    .from(recetas)
    .where(
      and(
        eq(recetas.varianteTerminadoId, varianteTerminadoId),
        eq(recetas.activa, true),
      ),
    )
    .limit(1);
  return r.length > 0;
}

/** Variantes de terminado que ya tienen receta activa (para el selector de órdenes). */
export async function varianteTerminadoConReceta() {
  return db
    .select({
      varianteId: variantes.id,
      label: variantes.nombre,
      productoNombre: productos.nombre,
    })
    .from(recetas)
    .innerJoin(variantes, eq(recetas.varianteTerminadoId, variantes.id))
    .innerJoin(productos, eq(variantes.productoId, productos.id))
    .where(eq(recetas.activa, true));
}
