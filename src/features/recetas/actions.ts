"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { productos, recetaItems, recetas, variantes } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { recetaInput, type RecetaInput } from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Guarda la receta de una variante de terminado. Si ya había una activa, la
 * desactiva y crea una nueva (histórico). Valida que los insumos sean insumos.
 */
export async function guardarReceta(
  input: RecetaInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = recetaInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  // El destino tiene que ser una variante de producto terminado activa.
  const term = await db.query.variantes.findFirst({
    where: eq(variantes.id, data.varianteTerminadoId),
    with: { producto: { columns: { esInsumo: true, activo: true } } },
  });
  if (!term || term.producto.esInsumo) {
    return { ok: false, error: "El destino debe ser un producto terminado." };
  }

  // Todos los ítems tienen que ser variantes de insumo, sin repetir.
  const insumoIds = data.items.map((i) => i.varianteInsumoId);
  if (new Set(insumoIds).size !== insumoIds.length) {
    return { ok: false, error: "Hay un insumo repetido en la receta." };
  }
  const insumos = await db
    .select({ id: variantes.id, esInsumo: productos.esInsumo })
    .from(variantes)
    .innerJoin(productos, eq(variantes.productoId, productos.id))
    .where(inArray(variantes.id, insumoIds));
  if (
    insumos.length !== insumoIds.length ||
    insumos.some((v) => !v.esInsumo)
  ) {
    return { ok: false, error: "Todos los ítems de la receta deben ser insumos." };
  }

  const recetaId = await db.transaction(async (tx) => {
    await tx
      .update(recetas)
      .set({ activa: false })
      .where(
        and(
          eq(recetas.varianteTerminadoId, data.varianteTerminadoId),
          eq(recetas.activa, true),
        ),
      );

    const [row] = await tx
      .insert(recetas)
      .values({
        varianteTerminadoId: data.varianteTerminadoId,
        rinde: data.rinde,
        notas: data.notas,
        activa: true,
      })
      .returning({ id: recetas.id });

    await tx.insert(recetaItems).values(
      data.items.map((it) => ({
        recetaId: row.id,
        varianteInsumoId: it.varianteInsumoId,
        cantidad: String(it.cantidad),
        mermaPct: String(it.mermaPct),
      })),
    );

    return row.id;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "receta",
    entidadId: recetaId,
    datos: { varianteTerminadoId: data.varianteTerminadoId, items: data.items.length },
  });

  revalidatePath(`/productos/${term.productoId}`);
  revalidatePath("/produccion");
  return { ok: true, id: recetaId };
}
