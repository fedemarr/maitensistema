"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

const hoy = () => new Date().toISOString().slice(0, 10);

const medioOpcional = z
  .union([z.uuid(), z.literal(""), z.literal("__none__")])
  .optional()
  .transform((v) => (v && v !== "__none__" ? v : null));

async function cargarConsignacionPendiente(id: string) {
  const cons = await db.query.consignaciones.findFirst({
    where: eq(consignaciones.id, id),
    with: {
      movimiento: {
        columns: { id: true },
        with: {
          items: {
            columns: { varianteId: true, cantidad: true, precioUnit: true, costoUnit: true },
            with: {
              variante: { columns: { id: true, costoPromedio: true, activo: true } },
            },
          },
        },
      },
    },
  });
  if (!cons) throw new Error("Consignación no encontrada.");
  if (cons.estado !== "pendiente") {
    throw new Error("La consignación ya fue cerrada.");
  }
  const items = cons.movimiento?.items ?? [];
  if (items.length === 0) throw new Error("La consignación no tiene ítems.");
  return { cons, items };
}

/**
 * Marca la consignación como vendida. Opcionalmente registra la venta por esas
 * unidades (movimiento `venta` + ajuste compensatorio para no descontar dos
 * veces el stock que ya salió al entregar la consignación).
 */
export async function marcarVendida(input: {
  id: string;
  registrarVenta?: boolean;
  medioPagoId?: string | null;
  precioTotal?: number;
}): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = z
    .object({
      id: z.uuid(),
      registrarVenta: z.boolean().default(false),
      medioPagoId: medioOpcional,
      precioTotal: z.coerce.number().nonnegative().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { id, registrarVenta, medioPagoId, precioTotal } = parsed.data;

  let cons: Awaited<ReturnType<typeof cargarConsignacionPendiente>>["cons"];
  let items: Awaited<ReturnType<typeof cargarConsignacionPendiente>>["items"];
  try {
    ({ cons, items } = await cargarConsignacionPendiente(id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Consignación inválida." };
  }

  try {
    await db.transaction(async (tx) => {
      if (registrarVenta) {
        const total =
          precioTotal ??
          items.reduce((a, i) => a + Number(i.precioUnit) * i.cantidad, 0);

        const [venta] = await tx
          .insert(movimientos)
          .values({
            tipo: "venta",
            fecha: hoy(),
            clienteId: cons.clienteId,
            medioPagoId,
            total: String(total),
            notas: `Venta de consignación (${cons.movimientoId})`,
            consignacionId: cons.id,
            creadoPor: user.id,
          })
          .returning({ id: movimientos.id });

        for (const it of items) {
          await tx.insert(movimientoItems).values({
            movimientoId: venta.id,
            varianteId: it.varianteId,
            cantidad: it.cantidad,
            precioUnit: String(it.precioUnit),
            costoUnit: String(it.variante?.costoPromedio ?? 0),
          });
          await tx
            .update(variantes)
            .set({ stock: sql`${variantes.stock} - ${it.cantidad}` })
            .where(eq(variantes.id, it.varianteId));
        }

        // Ajuste compensatorio: devuelve al stock las unidades que la venta
        // volvió a descontar (ya habían salido al entregar la consignación).
        const [ajuste] = await tx
          .insert(movimientos)
          .values({
            tipo: "ajuste",
            fecha: hoy(),
            total: "0",
            notas: `Ajuste por venta de consignación (${cons.movimientoId})`,
            creadoPor: user.id,
          })
          .returning({ id: movimientos.id });

        for (const it of items) {
          await tx.insert(movimientoItems).values({
            movimientoId: ajuste.id,
            varianteId: it.varianteId,
            cantidad: it.cantidad,
            precioUnit: "0",
            costoUnit: "0",
          });
          await tx
            .update(variantes)
            .set({ stock: sql`${variantes.stock} + ${it.cantidad}` })
            .where(eq(variantes.id, it.varianteId));
        }

        // Venta a crédito → asiento de CC del cliente.
        if (medioPagoId && total > 0) {
          const medio = await tx.query.mediosPago.findFirst({
            where: eq(mediosPago.id, medioPagoId),
            columns: { esCredito: true },
          });
          if (medio?.esCredito) {
            await tx.insert(ccMovimientos).values({
              entidadTipo: "cliente",
              entidadId: cons.clienteId,
              fecha: hoy(),
              debe: String(total),
              haber: "0",
              concepto: `Venta de consignación (${cons.movimientoId})`,
              movimientoId: venta.id,
            });
          }
        }

        // Contabilidad (módulo I): asiento de la venta (consignación vendida).
        await generarAsientoMovimiento(tx, venta.id, user.id);
      }

      await tx
        .update(consignaciones)
        .set({ estado: "vendido" })
        .where(eq(consignaciones.id, id));
    });
  } catch {
    return { ok: false, error: "No se pudo marcar la consignación como vendida." };
  }

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "consignacion",
    entidadId: id,
    datos: { estado: "vendido", registrarVenta },
  });

  revalidatePath("/consignaciones");
  revalidatePath("/movimientos");
  revalidatePath("/stock");
  revalidatePath("/contabilidad");
  return { ok: true };
}

/** Registra la devolución: suma stock y cierra la consignación. */
export async function registrarDevolucion(input: { id: string }): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { id } = parsed.data;

  let cons: Awaited<ReturnType<typeof cargarConsignacionPendiente>>["cons"];
  let items: Awaited<ReturnType<typeof cargarConsignacionPendiente>>["items"];
  try {
    ({ cons, items } = await cargarConsignacionPendiente(id));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Consignación inválida." };
  }

  try {
    await db.transaction(async (tx) => {
      const [mov] = await tx
        .insert(movimientos)
        .values({
          tipo: "devolucion_consignacion",
          fecha: hoy(),
          clienteId: cons.clienteId,
          total: "0",
          notas: `Devolución de consignación (${cons.movimientoId})`,
          creadoPor: user.id,
        })
        .returning({ id: movimientos.id });

      for (const it of items) {
        await tx.insert(movimientoItems).values({
          movimientoId: mov.id,
          varianteId: it.varianteId,
          cantidad: it.cantidad,
          precioUnit: String(it.precioUnit),
          costoUnit: String(it.variante?.costoPromedio ?? 0),
        });
        await tx
          .update(variantes)
          .set({ stock: sql`${variantes.stock} + ${it.cantidad}` })
          .where(eq(variantes.id, it.varianteId));
      }

      // Contabilidad (módulo I): asiento de la devolución (reingreso a Mercadería).
      await generarAsientoMovimiento(tx, mov.id, user.id);

      await tx
        .update(consignaciones)
        .set({ estado: "devuelto", cierreMovimientoId: mov.id })
        .where(eq(consignaciones.id, id));
    });
  } catch {
    return { ok: false, error: "No se pudo registrar la devolución." };
  }

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "consignacion-devolucion",
    entidadId: id,
    datos: { estado: "devuelto" },
  });

  revalidatePath("/consignaciones");
  revalidatePath("/movimientos");
  revalidatePath("/stock");
  revalidatePath("/contabilidad");
  return { ok: true };
}