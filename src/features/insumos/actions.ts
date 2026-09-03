"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  bajasInsumo,
  compraInsumoLineas,
  comprasInsumo,
  lotes,
  productos,
} from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { pppCompra, round2, round4 } from "@/lib/stock";
import {
  bajaInput,
  compraInput,
  insumoInput,
  type BajaInput,
  type CompraInput,
  type InsumoInput,
} from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function skuEnUso(sku: string, exceptId?: string) {
  const rows = await db
    .select({ id: productos.id })
    .from(productos)
    .where(
      and(
        sql`lower(${productos.sku}) = lower(${sku})`,
        exceptId ? ne(productos.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function guardarInsumo(
  input: InsumoInput,
  id?: string,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = insumoInput.safeParse(input);
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

  let insumoId = id;
  if (insumoId) {
    await db
      .update(productos)
      .set({
        sku: data.sku,
        nombre: data.nombre,
        unidad: data.unidad,
        reutilizable: data.reutilizable,
        vence: data.vence,
        proveedorHabitualId: data.proveedorHabitualId,
        activo: data.activo,
      })
      .where(eq(productos.id, insumoId));
  } else {
    const [row] = await db
      .insert(productos)
      .values({
        sku: data.sku,
        nombre: data.nombre,
        esInsumo: true,
        unidad: data.unidad,
        reutilizable: data.reutilizable,
        vence: data.vence,
        proveedorHabitualId: data.proveedorHabitualId,
        activo: data.activo,
      })
      .returning({ id: productos.id });
    insumoId = row.id;
  }

  await registrarAuditoria({
    actorId: user.id,
    accion: id ? "editar" : "crear",
    entidad: "insumo",
    entidadId: insumoId,
    datos: { sku: data.sku, nombre: data.nombre },
  });

  revalidatePath("/insumos");
  revalidatePath(`/insumos/${insumoId}`);
  return { ok: true, id: insumoId };
}

export async function toggleInsumoActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);
  await db.update(productos).set({ activo }).where(eq(productos.id, id));
  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "insumo",
    entidadId: id,
    datos: { activo },
  });
  revalidatePath("/insumos");
  revalidatePath(`/insumos/${id}`);
  return { ok: true, id };
}

/**
 * Registra una compra en tanda: crea el lote si hace falta, inserta la compra
 * y sus líneas, y por cada insumo suma stock y recalcula el PPP (promedio
 * ponderado). Todo en una transacción.
 */
export async function registrarCompra(
  input: CompraInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = compraInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const insumoIds = data.lineas.map((l) => l.insumoId);
  if (new Set(insumoIds).size !== insumoIds.length) {
    return { ok: false, error: "Hay un insumo repetido en la compra." };
  }

  const compraId = await db.transaction(async (tx) => {
    let loteId = data.loteId;
    if (!loteId && data.nuevoLoteNombre) {
      const [l] = await tx
        .insert(lotes)
        .values({ nombre: data.nuevoLoteNombre, fecha: data.fecha })
        .returning({ id: lotes.id });
      loteId = l.id;
    }

    const total = data.lineas.reduce((a, l) => a + l.costoTotal, 0);

    const [compra] = await tx
      .insert(comprasInsumo)
      .values({
        fecha: data.fecha,
        proveedorId: data.proveedorId,
        loteId: loteId ?? null,
        total: String(round2(total)),
        creadoPor: user.id,
      })
      .returning({ id: comprasInsumo.id });

    for (const l of data.lineas) {
      const insumo = await tx.query.productos.findFirst({
        where: eq(productos.id, l.insumoId),
        columns: { stockInsumo: true, ppp: true, esInsumo: true },
      });
      if (!insumo || !insumo.esInsumo) {
        return { ok: false as const, error: "Una línea no es un insumo válido." };
      }

      const costoUnitario = l.cantidad > 0 ? l.costoTotal / l.cantidad : 0;
      await tx.insert(compraInsumoLineas).values({
        compraId: compra.id,
        insumoId: l.insumoId,
        cantidad: String(round4(l.cantidad)),
        costoTotal: String(round2(l.costoTotal)),
        costoUnitario: String(round2(costoUnitario)),
        vencimiento: l.vencimiento,
      });

      const stockAntes = Number(insumo.stockInsumo);
      const pppAntes = Number(insumo.ppp);
      const nuevoPpp = pppCompra(
        stockAntes,
        pppAntes,
        l.cantidad,
        l.costoTotal,
      );
      await tx
        .update(productos)
        .set({
          stockInsumo: sql`${productos.stockInsumo} + ${round4(l.cantidad)}`,
          ppp: String(round2(nuevoPpp)),
        })
        .where(eq(productos.id, l.insumoId));
    }

    return compra.id;
  });

  if (typeof compraId !== "string") return compraId;

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "compra_insumo",
    entidadId: compraId,
    datos: { lineas: data.lineas.length },
  });

  revalidatePath("/insumos");
  return { ok: true, id: compraId };
}

/** Baja de insumo: descuenta stock y registra la pérdida (valuada al PPP). */
export async function registrarBaja(input: BajaInput): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = bajaInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const bajaId = await db.transaction(async (tx) => {
    const insumo = await tx.query.productos.findFirst({
      where: eq(productos.id, data.insumoId),
      columns: { stockInsumo: true, ppp: true, esInsumo: true, nombre: true },
    });
    if (!insumo || !insumo.esInsumo) {
      return { ok: false as const, error: "No es un insumo válido." };
    }
    const stock = Number(insumo.stockInsumo);
    if (data.cantidad > stock + 1e-9) {
      return {
        ok: false as const,
        error: `No hay stock suficiente de "${insumo.nombre}": hay ${stock}.`,
      };
    }

    const monto = round2(data.cantidad * Number(insumo.ppp));
    const [row] = await tx
      .insert(bajasInsumo)
      .values({
        fecha: data.fecha,
        insumoId: data.insumoId,
        cantidad: String(round4(data.cantidad)),
        motivo: data.motivo,
        monto: String(monto),
        loteId: data.loteId,
        creadoPor: user.id,
      })
      .returning({ id: bajasInsumo.id });

    await tx
      .update(productos)
      .set({
        stockInsumo: sql`greatest(0, ${productos.stockInsumo} - ${round4(data.cantidad)})`,
      })
      .where(eq(productos.id, data.insumoId));

    return row.id;
  });

  if (typeof bajaId !== "string") return bajaId;

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "baja_insumo",
    entidadId: bajaId,
    datos: { insumoId: data.insumoId, motivo: data.motivo },
  });

  revalidatePath("/insumos");
  return { ok: true, id: bajaId };
}
