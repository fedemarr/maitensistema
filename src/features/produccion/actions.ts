"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  movimientoItems,
  movimientos,
  ordenesProduccion,
  variantes,
} from "@/db/schema";
import { getRecetaActiva } from "@/features/recetas/queries";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { consumoInsumo, ordenInput, type OrdenInput } from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const revalidar = (id?: string) => {
  revalidatePath("/produccion");
  if (id) revalidatePath(`/produccion/${id}`);
  revalidatePath("/stock");
  revalidatePath("/productos");
  revalidatePath("/insumos");
  revalidatePath("/");
};

export async function crearOrden(input: OrdenInput): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = ordenInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const receta = await getRecetaActiva(data.varianteTerminadoId);
  if (!receta) {
    return {
      ok: false,
      error:
        "Ese producto no tiene receta activa. Cargá la receta desde la ficha del producto.",
    };
  }

  const [row] = await db
    .insert(ordenesProduccion)
    .values({
      varianteTerminadoId: data.varianteTerminadoId,
      cantidad: data.cantidad,
      fecha: data.fecha,
      notas: data.notas,
      estado: "borrador",
      creadoPor: user.id,
    })
    .returning({ id: ordenesProduccion.id });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "orden_produccion",
    entidadId: row.id,
    datos: { cantidad: data.cantidad },
  });

  revalidar(row.id);
  return { ok: true, id: row.id };
}

/**
 * Completa la orden: consume insumos y da de alta el terminado, todo en una
 * transacción. Invariantes de stock (ver Fase 2): atómico, sin negativos,
 * reversible.
 */
export async function completarOrden(id: string): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const orden = await db.query.ordenesProduccion.findFirst({
    where: eq(ordenesProduccion.id, id),
  });
  if (!orden) return { ok: false, error: "No encontré la orden." };
  if (orden.estado === "completada") {
    return { ok: false, error: "La orden ya está completada." };
  }
  if (orden.estado === "anulada") {
    return { ok: false, error: "La orden está anulada." };
  }

  const receta = await getRecetaActiva(orden.varianteTerminadoId);
  if (!receta) {
    return { ok: false, error: "El producto ya no tiene receta activa." };
  }

  // Consumo por insumo (entero, con merma, redondeo hacia arriba).
  const consumos = receta.items.map((it) => ({
    varianteInsumoId: it.varianteInsumoId,
    insumoLabel: it.insumoLabel,
    cantidad: consumoInsumo(
      Number(it.cantidad),
      Number(it.mermaPct),
      receta.rinde,
      orden.cantidad,
    ),
    costoPromedio: Number(it.costoPromedio),
  }));

  const result = await db.transaction(async (tx) => {
    // Releer stock de cada insumo DENTRO de la transacción y validar.
    let costoLote = 0;
    for (const c of consumos) {
      const v = await tx.query.variantes.findFirst({
        where: eq(variantes.id, c.varianteInsumoId),
        columns: { stock: true, nombre: true, costoPromedio: true },
      });
      if (!v) {
        return { ok: false as const, error: "Un insumo de la receta ya no existe." };
      }
      if (v.stock < c.cantidad) {
        return {
          ok: false as const,
          error: `Falta stock de "${c.insumoLabel}": necesitás ${c.cantidad} y hay ${v.stock}.`,
        };
      }
      costoLote += c.cantidad * Number(v.costoPromedio);
    }

    const costoUnitTerminado = costoLote / orden.cantidad;

    const [mov] = await tx
      .insert(movimientos)
      .values({
        tipo: "produccion",
        fecha: orden.fecha,
        total: String(costoLote.toFixed(2)),
        notas: `Orden de producción ${id.slice(0, 8)}`,
        creadoPor: user.id,
      })
      .returning({ id: movimientos.id });

    // Consumir insumos.
    for (const c of consumos) {
      await tx.insert(movimientoItems).values({
        movimientoId: mov.id,
        varianteId: c.varianteInsumoId,
        cantidad: c.cantidad,
        precioUnit: "0",
        costoUnit: String(c.costoPromedio.toFixed(2)),
      });
      await tx
        .update(variantes)
        .set({ stock: sql`${variantes.stock} - ${c.cantidad}` })
        .where(eq(variantes.id, c.varianteInsumoId));
    }

    // Alta del terminado + costo promedio ponderado.
    const term = await tx.query.variantes.findFirst({
      where: eq(variantes.id, orden.varianteTerminadoId),
      columns: { stock: true, costoPromedio: true },
    });
    if (!term) {
      return { ok: false as const, error: "La variante a producir ya no existe." };
    }
    const nuevoStock = term.stock + orden.cantidad;
    const nuevoCosto =
      (term.stock * Number(term.costoPromedio) + costoLote) / nuevoStock;

    await tx.insert(movimientoItems).values({
      movimientoId: mov.id,
      varianteId: orden.varianteTerminadoId,
      cantidad: orden.cantidad,
      precioUnit: "0",
      costoUnit: String(costoUnitTerminado.toFixed(2)),
    });
    await tx
      .update(variantes)
      .set({
        stock: sql`${variantes.stock} + ${orden.cantidad}`,
        costoPromedio: String(nuevoCosto.toFixed(2)),
      })
      .where(eq(variantes.id, orden.varianteTerminadoId));

    await tx
      .update(ordenesProduccion)
      .set({ estado: "completada", movimientoId: mov.id })
      .where(eq(ordenesProduccion.id, id));

    return { ok: true as const, id: mov.id };
  });

  if (!result.ok) return result;

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "orden_produccion",
    entidadId: id,
    datos: { estado: "completada", movimientoId: result.id },
  });

  revalidar(id);
  return { ok: true, id };
}

/** Anula una orden completada, revirtiendo el movimiento de producción. */
export async function anularOrden(id: string): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const orden = await db.query.ordenesProduccion.findFirst({
    where: eq(ordenesProduccion.id, id),
  });
  if (!orden) return { ok: false, error: "No encontré la orden." };

  if (orden.estado === "borrador" || orden.estado === "en_proceso") {
    await db
      .update(ordenesProduccion)
      .set({ estado: "anulada" })
      .where(eq(ordenesProduccion.id, id));
    await registrarAuditoria({
      actorId: user.id,
      accion: "editar",
      entidad: "orden_produccion",
      entidadId: id,
      datos: { estado: "anulada" },
    });
    revalidar(id);
    return { ok: true, id };
  }

  if (orden.estado !== "completada" || !orden.movimientoId) {
    return { ok: false, error: "La orden no se puede anular en este estado." };
  }

  const mov = await db.query.movimientos.findFirst({
    where: eq(movimientos.id, orden.movimientoId),
    with: {
      items: {
        with: {
          variante: {
            with: { producto: { columns: { esInsumo: true } } },
          },
        },
      },
    },
  });
  if (!mov) return { ok: false, error: "No encontré el movimiento de la orden." };

  const result = await db.transaction(async (tx) => {
    for (const it of mov.items) {
      const esInsumo = it.variante.producto.esInsumo;
      // Insumo: devolver stock (+). Terminado: quitar el producido (−).
      const delta = esInsumo ? it.cantidad : -it.cantidad;

      if (!esInsumo) {
        const v = await tx.query.variantes.findFirst({
          where: eq(variantes.id, it.varianteId),
          columns: { stock: true, nombre: true },
        });
        if (v && v.stock - it.cantidad < 0) {
          return {
            ok: false as const,
            error: `No se puede anular: ya se consumieron unidades de "${v.nombre}" producidas por esta orden.`,
          };
        }
      }

      await tx
        .update(variantes)
        .set({ stock: sql`${variantes.stock} + ${delta}` })
        .where(eq(variantes.id, it.varianteId));
    }

    await tx.delete(movimientos).where(eq(movimientos.id, mov.id));
    await tx
      .update(ordenesProduccion)
      .set({ estado: "anulada", movimientoId: null })
      .where(eq(ordenesProduccion.id, id));

    return { ok: true as const };
  });

  if (!result.ok) return result;

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "orden_produccion",
    entidadId: id,
    datos: { estado: "anulada", revirtioMovimiento: mov.id },
  });

  revalidar(id);
  return { ok: true, id };
}
