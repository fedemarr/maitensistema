"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { movimientoItems, movimientos, productos, variantes } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { contarMovimientosDeVariante, skuEnUso } from "./queries";
import { productoInput, type ProductoInput } from "./schema";

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
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  if (await skuEnUso(data.sku, id)) {
    return { ok: false, error: `El SKU "${data.sku}" ya está en uso.` };
  }

  const productoId = await db.transaction(async (tx) => {
    let pid = id;

    if (pid) {
      await tx
        .update(productos)
        .set({
          sku: data.sku,
          nombre: data.nombre,
          rubroId: data.rubroId,
          precioLista: String(data.precioLista),
          online: data.online,
          activo: data.activo,
          esInsumo: data.esInsumo,
          fotoPath: data.fotoPath,
        })
        .where(eq(productos.id, pid));
    } else {
      const [row] = await tx
        .insert(productos)
        .values({
          sku: data.sku,
          nombre: data.nombre,
          rubroId: data.rubroId,
          precioLista: String(data.precioLista),
          online: data.online,
          activo: data.activo,
          esInsumo: data.esInsumo,
          fotoPath: data.fotoPath,
        })
        .returning({ id: productos.id });
      pid = row.id;
    }

    const conId = data.variantes.filter((v) => v.id).map((v) => v.id!) as string[];

    // Variantes que se sacaron del formulario.
    const sobrantes = await tx
      .select({ id: variantes.id })
      .from(variantes)
      .where(
        and(
          eq(variantes.productoId, pid),
          conId.length ? notInArray(variantes.id, conId) : undefined,
        ),
      );

    for (const s of sobrantes) {
      const usos = await contarMovimientosDeVariante(s.id);
      if (usos > 0) {
        await tx
          .update(variantes)
          .set({ activo: false })
          .where(eq(variantes.id, s.id));
      } else {
        await tx.delete(variantes).where(eq(variantes.id, s.id));
      }
    }

    // Si alguna variante nueva trae stock inicial, creamos un movimiento
    // `ajuste` que lo registra (invariantes: solo movimientos cambian stock).
    const variantesNuevas = data.variantes.filter((v) => !v.id && v.stock > 0);
    let ajusteInicialId: string | null = null;
    if (variantesNuevas.length > 0) {
      const [adj] = await tx
        .insert(movimientos)
        .values({
          tipo: "ajuste",
          fecha: new Date().toISOString().slice(0, 10),
          total: "0",
          notas: "Carga inicial de stock",
          creadoPor: user.id,
        })
        .returning({ id: movimientos.id });
      ajusteInicialId = adj.id;
    }

    for (const v of data.variantes) {
      if (v.id) {
        // Variante existente: stock y costo son solo lectura (se ajustan en Movimientos).
        await tx
          .update(variantes)
          .set({
            productoId: pid,
            nombre: v.nombre,
            presentacion: v.presentacion,
            fragancia: v.fragancia,
            stockMin: v.stockMin,
            activo: true,
          })
          .where(eq(variantes.id, v.id));
      } else {
        // Variante nueva: toma un costo inicial; el stock inicial se registra
        // como un movimiento `ajuste` en la misma transacción.
        const [row] = await tx
          .insert(variantes)
          .values({
            productoId: pid,
            nombre: v.nombre,
            presentacion: v.presentacion,
            fragancia: v.fragancia,
            stock: 0,
            stockMin: v.stockMin,
            costoPromedio: String(v.costoPromedio),
            activo: true,
          })
          .returning({ id: variantes.id });

        if (v.stock > 0 && ajusteInicialId) {
          await tx.insert(movimientoItems).values({
            movimientoId: ajusteInicialId,
            varianteId: row.id,
            cantidad: v.stock,
            precioUnit: "0",
            costoUnit: "0",
          });
          await tx
            .update(variantes)
            .set({ stock: sql`${variantes.stock} + ${v.stock}` })
            .where(eq(variantes.id, row.id));
        }
      }
    }

    return pid;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: id ? "editar" : "crear",
    entidad: "producto",
    entidadId: productoId,
    datos: { sku: data.sku, nombre: data.nombre },
  });

  revalidatePath("/productos");
  revalidatePath("/insumos");
  revalidatePath(`/productos/${productoId}`);
  revalidatePath("/movimientos");
  revalidatePath("/stock");
  return { ok: true, id: productoId };
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

export async function eliminarProducto(id: string): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const vs = await db
    .select({ id: variantes.id })
    .from(variantes)
    .where(eq(variantes.productoId, id));

  for (const v of vs) {
    if ((await contarMovimientosDeVariante(v.id)) > 0) {
      return {
        ok: false,
        error:
          "El producto tiene movimientos registrados. Marcá el producto como inactivo en lugar de eliminarlo.",
      };
    }
  }

  await db.transaction(async (tx) => {
    if (vs.length) {
      await tx.delete(variantes).where(
        inArray(
          variantes.id,
          vs.map((v) => v.id),
        ),
      );
    }
    await tx.delete(productos).where(eq(productos.id, id));
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: "borrar",
    entidad: "producto",
    entidadId: id,
  });

  revalidatePath("/productos");
  return { ok: true, id };
}
