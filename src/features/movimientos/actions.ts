"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  ccMovimientos,
  consignaciones,
  mediosPago,
  movimientoItems,
  movimientos,
  variantes,
} from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { generarAsientoMovimiento } from "@/features/contabilidad/lib/asientos";
import {
  movimientoInput,
  reglaDe,
  signoNumerico,
  type MovimientoInput,
} from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Suma una fecha de "años" (ajuste de vencimiento de consignación). */
function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Crea un movimiento de stock en una sola transacción: inserta el movimiento,
 * sus ítems, aplica el delta a `variantes.stock` (atómico), actualiza el
 * costo promedio en ingresos, y dispara efectos extra (CC por crédito,
 * consignación pendiente). Si algo falla, no se mueve nada.
 */
export async function crearMovimiento(
  input: MovimientoInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = movimientoInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;
  const regla = reglaDe(data.tipo);

  // Validaciones de la tabla de reglas.
  if (regla.tercero === "proveedor-requerido" && !data.proveedorId) {
    return { ok: false, error: "Un ingreso requiere un proveedor." };
  }
  if (regla.tercero === "cliente-requerido" && !data.clienteId) {
    return { ok: false, error: "Este tipo de movimiento requiere un cliente." };
  }
  if (regla.medioPago === "requerido" && !data.medioPagoId) {
    return { ok: false, error: "La venta requiere un medio de pago." };
  }
  if (regla.requiereNotas && !data.notas) {
    return { ok: false, error: "El ajuste de stock requiere un motivo (notas)." };
  }
  if (regla.tercero === "ninguno" && (data.clienteId || data.proveedorId)) {
    return {
      ok: false,
      error: "Este tipo de movimiento no admite cliente ni proveedor.",
    };
  }

  // Si la venta es a crédito, necesitamos un cliente para el asiento de CC.
  if (data.tipo === "venta" && data.medioPagoId) {
    const medio = await db.query.mediosPago.findFirst({
      where: eq(mediosPago.id, data.medioPagoId),
      columns: { esCredito: true },
    });
    if (medio?.esCredito && !data.clienteId) {
      return {
        ok: false,
        error: "Una venta a crédito requiere indicar el cliente.",
      };
    }
  }

  const result = await db.transaction(async (tx) => {
    // Ítems del catálogo (stock, activo, costo, precio) leídos dentro de la tx.
    const itemDeltas: {
      varianteId: string;
      delta: number;
      cantidad: number;
      objetivo?: number;
    }[] = [];

    for (const item of data.items) {
      const v = await tx.query.variantes.findFirst({
        where: eq(variantes.id, item.varianteId),
        with: { producto: { columns: { activo: true } } },
      });
      if (!v) {
        return { ok: false as const, error: "Encontré una variante inexistente." };
      }

      // Variante o producto inactivo no admite movimientos (salvo ajuste).
      if (data.tipo !== "ajuste" && (!v.activo || !v.producto.activo)) {
        return {
          ok: false as const,
          error: `La variante "${v.nombre}" o su producto están inactivos. Solo se pueden ajustar.`,
        };
      }

      if (regla.signo === "ajuste") {
        // `cantidad` del form es el objetivo; guardamos el delta con signo.
        const objetivo = item.cantidad;
        if (!Number.isInteger(objetivo) || objetivo < 0) {
          return {
            ok: false as const,
            error: `El objetivo de stock para "${v.nombre}" debe ser un entero no negativo.`,
          };
        }
        const delta = objetivo - v.stock;
        if (delta === 0) continue;
        itemDeltas.push({ varianteId: v.id, delta, cantidad: delta, objetivo });
      } else {
        const delta = signoNumerico(regla) * item.cantidad;
        // Invariante 4: nunca stock negativo.
        if (v.stock + delta < 0) {
          return {
            ok: false as const,
            error: `Stock insuficiente para "${v.nombre}": quedan ${v.stock} y querés sacar ${item.cantidad}.`,
          };
        }
        itemDeltas.push({ varianteId: v.id, delta, cantidad: item.cantidad });
      }
    }

    if (itemDeltas.length === 0) {
      return {
        ok: false as const,
        error: "El movimiento no modifica stock (verificá los montos).",
      };
    }

    // Total del movimiento según la regla.
    let total = 0;
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (regla.total === "suma-precio") total += item.precioUnit * item.cantidad;
      else if (regla.total === "costo") total += item.costoUnit * item.cantidad;
    }

    const [mov] = await tx
      .insert(movimientos)
      .values({
        tipo: data.tipo,
        fecha: data.fecha,
        clienteId: data.clienteId,
        proveedorId: data.proveedorId,
        medioPagoId: data.medioPagoId,
        total: String(total),
        notas: data.notas,
        creadoPor: user.id,
      })
      .returning({ id: movimientos.id });

    // Aplicar ítems: insertar, delta atómico, y costo promedio en ingresos.
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const d = itemDeltas.find((x) => x.varianteId === item.varianteId);
      if (!d || d.delta === 0) continue;

      await tx.insert(movimientoItems).values({
        movimientoId: mov.id,
        varianteId: item.varianteId,
        cantidad: d.cantidad,
        precioUnit: String(item.precioUnit),
        costoUnit:
          regla.signo === 1
            ? String(item.costoUnit)
            : String(
                (
                  await tx.query.variantes.findFirst({
                    where: eq(variantes.id, item.varianteId),
                    columns: { costoPromedio: true },
                  })
                )?.costoPromedio ?? 0,
              ),
      });

      // Actualización atómica (invariante 7): set stock = stock + delta.
      await tx
        .update(variantes)
        .set({ stock: sql`${variantes.stock} + ${d.delta}` })
        .where(eq(variantes.id, item.varianteId));

      if (regla.actualizaCosto) {
        const v = await tx.query.variantes.findFirst({
          where: eq(variantes.id, item.varianteId),
          columns: { stock: true, costoPromedio: true },
        });
        if (v) {
          const stockAntes = v.stock - d.delta;
          const costoAntes = Number(v.costoPromedio);
          if (stockAntes + d.delta > 0) {
            const nuevoCosto =
              (stockAntes * costoAntes + d.delta * item.costoUnit) /
              (stockAntes + d.delta);
            await tx
              .update(variantes)
              .set({ costoPromedio: String(nuevoCosto) })
              .where(eq(variantes.id, item.varianteId));
          }
        }
      }
    }

    // Efecto extra: venta a crédito → asiento de CC del cliente (débito).
    if (data.tipo === "venta" && data.clienteId && data.medioPagoId && total > 0) {
      const medio = await tx.query.mediosPago.findFirst({
        where: eq(mediosPago.id, data.medioPagoId),
        columns: { esCredito: true },
      });
      if (medio?.esCredito) {
        await tx.insert(ccMovimientos).values({
          entidadTipo: "cliente",
          entidadId: data.clienteId,
          fecha: data.fecha,
          debe: String(total),
          haber: "0",
          concepto: "Venta a crédito",
          movimientoId: mov.id,
        });
      }
    }

    // Efecto extra: ingreso a plazo (medio a crédito) → asiento de CC proveedor (haber).
    if (data.tipo === "ingreso" && data.proveedorId && data.medioPagoId && total > 0) {
      const medio = await tx.query.mediosPago.findFirst({
        where: eq(mediosPago.id, data.medioPagoId),
        columns: { esCredito: true },
      });
      if (medio?.esCredito) {
        await tx.insert(ccMovimientos).values({
          entidadTipo: "proveedor",
          entidadId: data.proveedorId,
          fecha: data.fecha,
          debe: "0",
          haber: String(total),
          concepto: "Ingreso a plazo",
          movimientoId: mov.id,
        });
      }
    }

    // Efecto extra: consignación → fila pendiente en consignaciones (módulo H).
    if (regla.creaConsignacion && data.clienteId) {
      await tx.insert(consignaciones).values({
        movimientoId: mov.id,
        clienteId: data.clienteId,
        fecha: data.fecha,
        venceEl: sumarDias(data.fecha, 30),
        estado: "pendiente",
      });
    }

    // Contabilidad (módulo I): asiento automático derivado del movimiento.
    await generarAsientoMovimiento(tx, mov.id, user.id);

    return { ok: true as const, id: mov.id };
  });

  if (!result.ok) return result;

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "movimiento",
    entidadId: result.id,
    datos: { tipo: data.tipo, total: String(totalDe(data)) },
  });

  revalidatePath("/movimientos");
  revalidatePath(`/movimientos/${result.id}`);
  revalidatePath("/stock");
  revalidatePath("/productos");
  revalidatePath("/");
  revalidatePath("/contabilidad");
  return { ok: true, id: result.id };
}

function totalDe(data: MovimientoInput): number {
  const regla = reglaDe(data.tipo);
  let total = 0;
  for (const item of data.items) {
    if (regla.total === "suma-precio") total += item.precioUnit * item.cantidad;
    else if (regla.total === "costo") total += item.costoUnit * item.cantidad;
  }
  return total;
}

/**
 * Elimina un movimiento (solo admin) revirtiendo exactamente su efecto:
 * stock, asiento de CC y consignación, en una única transacción.
 */
export async function eliminarMovimiento(id: string): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const mov = await db.query.movimientos.findFirst({
    where: eq(movimientos.id, id),
    with: {
      items: { columns: { varianteId: true, cantidad: true } },
    },
  });
  if (!mov) return { ok: false, error: "No encontré el movimiento." };

  if (mov.tipo === "produccion") {
    return {
      ok: false,
      error:
        "Este movimiento sale de una orden de producción. Anulá la orden desde Producción.",
    };
  }

  const result = await db.transaction(async (tx) => {
    const regla = reglaDe(mov.tipo as MovimientoInput["tipo"]);

    // Revertir stock: para todos los ítems, aplicamos el delta inverso (atómico).
    // Para `ajuste`, cantidad guarda el delta con signo, así que −delta restaura.
    for (const item of mov.items) {
      const delta =
        regla.signo === "ajuste"
          ? item.cantidad
          : signoNumerico(regla) * item.cantidad;

      // Invariante 4: revertir no puede dejar stock negativo (ej: borrar un
      // ingreso cuya mercadería ya se vendió). Chequeo explícito + CHECK en la BD.
      const v = await tx.query.variantes.findFirst({
        where: eq(variantes.id, item.varianteId),
        columns: { stock: true, nombre: true },
      });
      if (v && v.stock - delta < 0) {
        return {
          ok: false as const,
          error: `No se puede eliminar: dejaría la variante "${v.nombre}" con stock negativo (${v.stock} − ${delta}). Cargá primero los movimientos que faltan o hacé un ajuste.`,
        };
      }

      await tx
        .update(variantes)
        .set({ stock: sql`${variantes.stock} - ${delta}` })
        .where(eq(variantes.id, item.varianteId));
    }

    // Borrar efectos extra vía cascada/relación.
    await tx.delete(ccMovimientos).where(eq(ccMovimientos.movimientoId, id));
    await tx.delete(consignaciones).where(eq(consignaciones.movimientoId, id));

    await tx.delete(movimientos).where(eq(movimientos.id, id));
    return { ok: true as const };
  });

  if (!result.ok) return result;

  await registrarAuditoria({
    actorId: user.id,
    accion: "borrar",
    entidad: "movimiento",
    entidadId: id,
  });

  revalidatePath("/movimientos");
  revalidatePath("/stock");
  revalidatePath("/productos");
  revalidatePath("/");
  revalidatePath("/contabilidad");
  return { ok: true, id };
}
