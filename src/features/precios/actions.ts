"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { preciosVenta } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { round2 } from "@/lib/stock";
import { precioInput, type PrecioInput } from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const revalidar = () => {
  revalidatePath("/precios");
  revalidatePath("/movimientos/nuevo");
};

/** Día anterior a `fecha` (YYYY-MM-DD). */
function diaAnterior(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Guarda el precio vigente de un producto para una lista (retail/mayorista).
 * Si ya había uno vigente con otro monto, lo cierra y crea una nueva versión.
 */
export async function guardarPrecio(input: PrecioInput): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = precioInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const vigente = await db.query.preciosVenta.findFirst({
    where: and(
      eq(preciosVenta.productoId, data.productoId),
      eq(preciosVenta.tipoLista, data.tipoLista),
      isNull(preciosVenta.vigenteHasta),
    ),
  });

  if (vigente && Number(vigente.precioConIva) === round2(data.precioConIva)) {
    return { ok: true, id: vigente.id };
  }

  const nuevoId = await db.transaction(async (tx) => {
    if (vigente) {
      await tx
        .update(preciosVenta)
        .set({ vigenteHasta: diaAnterior(data.vigenteDesde) })
        .where(eq(preciosVenta.id, vigente.id));
    }
    const [row] = await tx
      .insert(preciosVenta)
      .values({
        productoId: data.productoId,
        tipoLista: data.tipoLista,
        precioConIva: String(round2(data.precioConIva)),
        vigenteDesde: data.vigenteDesde,
      })
      .returning({ id: preciosVenta.id });
    return row.id;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: vigente ? "editar" : "crear",
    entidad: "precio_venta",
    entidadId: nuevoId,
    datos: {
      productoId: data.productoId,
      tipoLista: data.tipoLista,
      precioConIva: data.precioConIva,
    },
  });

  revalidar();
  return { ok: true, id: nuevoId };
}
