"use server";

import { and, eq, isNull, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { productos, recetaLineas, recetas } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { skuEnUso } from "./queries";
import {
  nuevaRecetaInput,
  productoInput,
  type NuevaRecetaInput,
  type ProductoInput,
} from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function guardarProducto(
  input: ProductoInput,
  id?: string,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = productoInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  if (await skuEnUso(data.sku, id)) {
    return { ok: false, error: `El SKU "${data.sku}" ya está en uso.` };
  }

  let productoId = id;
  if (productoId) {
    await db
      .update(productos)
      .set({
        sku: data.sku,
        nombre: data.nombre,
        rubroId: data.rubroId,
        presentacion: data.presentacion,
        stockMinimo: data.stockMinimo,
        online: data.online,
        activo: data.activo,
      })
      .where(eq(productos.id, productoId));
  } else {
    const [row] = await db
      .insert(productos)
      .values({
        sku: data.sku,
        nombre: data.nombre,
        rubroId: data.rubroId,
        presentacion: data.presentacion,
        stockMinimo: data.stockMinimo,
        online: data.online,
        activo: data.activo,
        esInsumo: false,
      })
      .returning({ id: productos.id });
    productoId = row.id;
  }

  await registrarAuditoria({
    actorId: user.id,
    accion: id ? "editar" : "crear",
    entidad: "producto",
    entidadId: productoId,
    datos: { sku: data.sku, nombre: data.nombre },
  });

  revalidatePath("/productos");
  revalidatePath(`/productos/${productoId}`);
  return { ok: true, id: productoId };
}

export async function setStockMinimo(
  id: string,
  stockMinimo: number,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);
  const min = Math.max(0, Math.trunc(stockMinimo));
  await db.update(productos).set({ stockMinimo: min }).where(eq(productos.id, id));
  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "producto",
    entidadId: id,
    datos: { stockMinimo: min },
  });
  revalidatePath("/productos");
  revalidatePath("/stock");
  revalidatePath(`/productos/${id}`);
  return { ok: true, id };
}

export async function toggleProductoActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);
  await db.update(productos).set({ activo }).where(eq(productos.id, id));
  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "producto",
    entidadId: id,
    datos: { activo },
  });
  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
  return { ok: true, id };
}

/**
 * Crea una versión nueva de receta: cierra la vigencia de la anterior el día
 * anterior a `vigenteDesde` y numera consecutivo. Los lotes viejos quedan
 * atados a su versión (spec §3.1, D-03).
 */
export async function nuevaVersionReceta(
  input: NuevaRecetaInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = nuevaRecetaInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const insumoIds = data.lineas.map((l) => l.insumoId);
  if (new Set(insumoIds).size !== insumoIds.length) {
    return { ok: false, error: "Hay un insumo repetido en la receta." };
  }
  const insumos = await db.query.productos.findMany({
    where: and(eq(productos.esInsumo, true)),
    columns: { id: true, unidad: true },
  });
  const byId = new Map(insumos.map((i) => [i.id, i]));
  if (insumoIds.some((iid) => !byId.has(iid))) {
    return { ok: false, error: "Todas las líneas deben ser insumos válidos." };
  }

  const recetaId = await db.transaction(async (tx) => {
    const vigente = await tx.query.recetas.findFirst({
      where: and(
        eq(recetas.productoId, data.productoId),
        isNull(recetas.vigenteHasta),
      ),
    });

    const [{ n }] = await tx
      .select({ n: max(recetas.numero) })
      .from(recetas)
      .where(eq(recetas.productoId, data.productoId));
    const numero = (n ?? 0) + 1;

    const desde = new Date(`${data.vigenteDesde}T00:00:00`);
    const hastaAnterior = new Date(desde);
    hastaAnterior.setDate(hastaAnterior.getDate() - 1);

    if (vigente) {
      await tx
        .update(recetas)
        .set({ vigenteHasta: hastaAnterior.toISOString().slice(0, 10) })
        .where(eq(recetas.id, vigente.id));
    }

    const [row] = await tx
      .insert(recetas)
      .values({
        productoId: data.productoId,
        numero,
        vigenteDesde: data.vigenteDesde,
        notas: data.notas,
      })
      .returning({ id: recetas.id });

    await tx.insert(recetaLineas).values(
      data.lineas.map((l) => ({
        recetaId: row.id,
        insumoId: l.insumoId,
        cantidadPorUnidad: String(l.cantidadPorUnidad),
        unidad: byId.get(l.insumoId)!.unidad ?? "kg",
      })),
    );

    return row.id;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "receta",
    entidadId: recetaId,
    datos: { productoId: data.productoId, lineas: data.lineas.length },
  });

  revalidatePath(`/productos/${data.productoId}`);
  revalidatePath("/produccion");
  return { ok: true, id: recetaId };
}
