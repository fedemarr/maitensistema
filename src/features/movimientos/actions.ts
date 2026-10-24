"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { db } from "@/db";
import {
  ccMovimientos,
  clientes,
  consignaciones,
  movimientoItemLotes,
  movimientoItems,
  movimientos,
  productos,
  stockLotes,
} from "@/db/schema";
import { facturaDeMovimiento } from "@/features/afip/queries";
import { generarAsientoMovimiento } from "@/features/finanzas/lib/posting";
import { asientoLineas, asientos } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { round2, tomarFifo } from "@/lib/stock";
import {
  movimientoInput,
  reglaDe,
  TIPO_LABEL,
  type MovimientoInput,
  type Regla,
  type TipoManual,
} from "./schema";

/** Tipos que solo tocan depósito (sin consignación) — los únicos editables
 * con recálculo por ahora (adenda v1.3 §2.1, alcance acotado). */
const EDITABLES_CON_RECALCULO = new Set<TipoManual>([
  "venta",
  "canje",
  "presentacion",
  "regalo",
  "rotura",
  "sorteo",
  "tester",
  "co_branding",
  "influencer",
  "prueba",
  "ajuste",
]);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const revalidar = () => {
  revalidatePath("/movimientos");
  revalidatePath("/stock");
  revalidatePath("/consignaciones");
  revalidatePath("/clientes");
  revalidatePath("/reportes");
  revalidatePath("/finanzas");
  revalidatePath("/");
};

function sumarDias(fechaISO: string, dias: number) {
  const d = new Date(`${fechaISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function crearMovimiento(
  input: MovimientoInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);
  const res = await crearMovimientoComo(input, user.id);
  if (res.ok) {
    // Cambió el stock: empujarlo a Tiendanube después de responder.
    after(async () => {
      const { sincronizarStockSeguro } = await import(
        "@/features/tiendanube/sync"
      );
      await sincronizarStockSeguro();
    });
  }
  return res;
}

/**
 * Núcleo de creación de movimiento SIN control de permisos. Lo usa la acción
 * `crearMovimiento` (con el usuario) y el webhook de Tiendanube (con actor
 * nulo y `meta.origen = "tiendanube"`).
 */
export async function crearMovimientoComo(
  input: MovimientoInput,
  actorId: string | null,
  meta: { origen?: string; origenExterno?: string | null } = {},
): Promise<ActionResult> {
  const parsed = movimientoInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;
  const regla = reglaDe(data.tipo);

  if (regla.tercero === "cliente_req" && !data.clienteId && !data.nuevoCliente) {
    return { ok: false, error: "Este tipo de movimiento requiere un cliente." };
  }
  if (regla.pideMedioPago && !data.medioPago) {
    return { ok: false, error: "La venta requiere un medio de pago." };
  }
  if (regla.tercero === "ninguno" && (data.clienteId || data.nuevoCliente)) {
    return { ok: false, error: "Este tipo de movimiento no lleva cliente." };
  }
  if (data.tipo === "ajuste") {
    const haySuma = data.items.some((i) => i.cantidad > 0);
    if (haySuma && !data.loteId) {
      return {
        ok: false,
        error: "Un ajuste que suma stock necesita indicar el lote.",
      };
    }
  }
  for (const it of data.items) {
    if (data.tipo === "ajuste") {
      if (it.cantidad === 0)
        return { ok: false, error: "La cantidad del ajuste no puede ser 0." };
    } else if (it.cantidad <= 0) {
      return { ok: false, error: "Las cantidades deben ser mayores a 0." };
    }
  }

  const result = await db.transaction(async (tx) => {
    // Cliente (alta rápida).
    let clienteId = data.clienteId;
    if (!clienteId && data.nuevoCliente) {
      const [c] = await tx
        .insert(clientes)
        .values({
          nombre: data.nuevoCliente.nombre,
          tipo: data.nuevoCliente.tipo,
          notas: "Alta rápida desde Movimientos",
        })
        .returning({ id: clientes.id });
      clienteId = c.id;
    }

    const [mov] = await tx
      .insert(movimientos)
      .values({
        fecha: data.fecha,
        tipo: data.tipo,
        clienteId: clienteId ?? null,
        medioPago: regla.pideMedioPago ? (data.medioPago ?? null) : null,
        origen: meta.origen ?? "manual",
        origenExterno: meta.origenExterno ?? null,
        observaciones: data.observaciones,
        creadoPor: actorId,
      })
      .returning({ id: movimientos.id });

    let totalCredito = 0;

    for (const it of data.items) {
      const prod = await tx.query.productos.findFirst({
        where: eq(productos.id, it.productoId),
        columns: { ppp: true, nombre: true, esInsumo: true },
      });
      if (!prod || prod.esInsumo) {
        return { ok: false as const, error: "Ítem con producto inválido." };
      }
      const ppp = Number(prod.ppp);
      const abs = Math.abs(it.cantidad);
      const tomasLote: { loteId: string; cantidad: number }[] = [];
      let consignacionRef: string | null = null;

      // ── Efecto sobre el depósito (stock_lotes) ──
      if (
        regla.deposito === "resta" ||
        (regla.deposito === "ajuste" && it.cantidad < 0)
      ) {
        const disp = await tx.query.stockLotes.findMany({
          where: eq(stockLotes.productoId, it.productoId),
          with: { lote: { columns: { fecha: true } } },
        });
        disp.sort((a, b) => a.lote.fecha.localeCompare(b.lote.fecha));

        const { tomas, faltante } = tomarFifo(
          disp.map((d) => ({
            loteId: d.loteId,
            unidades: d.unidadesEnDeposito,
          })),
          abs,
        );
        if (faltante > 0) {
          return {
            ok: false as const,
            error: `Stock insuficiente en depósito de "${prod.nombre}" (faltan ${faltante}).`,
          };
        }
        for (const t of tomas) {
          await tx
            .update(stockLotes)
            .set({
              unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} - ${t.cantidad}`,
            })
            .where(
              and(
                eq(stockLotes.productoId, it.productoId),
                eq(stockLotes.loteId, t.loteId),
              ),
            );
          tomasLote.push(t);
        }
      } else if (regla.deposito === "ajuste" && it.cantidad > 0) {
        const existe = await tx
          .select({ u: stockLotes.unidadesEnDeposito })
          .from(stockLotes)
          .where(
            and(
              eq(stockLotes.productoId, it.productoId),
              eq(stockLotes.loteId, data.loteId!),
            ),
          )
          .limit(1);
        if (existe.length) {
          await tx
            .update(stockLotes)
            .set({
              unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} + ${abs}`,
            })
            .where(
              and(
                eq(stockLotes.productoId, it.productoId),
                eq(stockLotes.loteId, data.loteId!),
              ),
            );
        } else {
          await tx.insert(stockLotes).values({
            productoId: it.productoId,
            loteId: data.loteId!,
            unidadesEnDeposito: abs,
          });
        }
        tomasLote.push({ loteId: data.loteId!, cantidad: abs });
      }

      // ── Consignaciones ──
      if (regla.consig === "entregar" && clienteId) {
        // Una consignación por lote entregado, vence a 60 días.
        for (const t of tomasLote) {
          await tx.insert(consignaciones).values({
            fecha: data.fecha,
            vence: sumarDias(data.fecha, 60),
            clienteId,
            productoId: it.productoId,
            loteId: t.loteId,
            entregadas: t.cantidad,
            movimientoOrigenId: mov.id,
          });
        }
      } else if (
        (regla.consig === "vender" || regla.consig === "devolver") &&
        clienteId
      ) {
        const abiertas = await tx
          .select()
          .from(consignaciones)
          .where(
            and(
              eq(consignaciones.clienteId, clienteId),
              eq(consignaciones.productoId, it.productoId),
            ),
          )
          .orderBy(asc(consignaciones.fecha));
        let restante = abs;
        for (const c of abiertas) {
          if (restante <= 0) break;
          const pend = c.entregadas - c.vendidas - c.devueltas;
          if (pend <= 0) continue;
          const toma = Math.min(pend, restante);
          if (!consignacionRef) consignacionRef = c.id;
          if (regla.consig === "vender") {
            await tx
              .update(consignaciones)
              .set({ vendidas: sql`${consignaciones.vendidas} + ${toma}` })
              .where(eq(consignaciones.id, c.id));
          } else {
            await tx
              .update(consignaciones)
              .set({ devueltas: sql`${consignaciones.devueltas} + ${toma}` })
              .where(eq(consignaciones.id, c.id));
            // Devolución: vuelve al depósito, al lote de la consignación.
            const existe = await tx
              .select({ u: stockLotes.unidadesEnDeposito })
              .from(stockLotes)
              .where(
                and(
                  eq(stockLotes.productoId, it.productoId),
                  eq(stockLotes.loteId, c.loteId),
                ),
              )
              .limit(1);
            if (existe.length) {
              await tx
                .update(stockLotes)
                .set({
                  unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} + ${toma}`,
                })
                .where(
                  and(
                    eq(stockLotes.productoId, it.productoId),
                    eq(stockLotes.loteId, c.loteId),
                  ),
                );
            } else {
              await tx.insert(stockLotes).values({
                productoId: it.productoId,
                loteId: c.loteId,
                unidadesEnDeposito: toma,
              });
            }
          }
          tomasLote.push({ loteId: c.loteId, cantidad: toma });
          restante -= toma;
        }
        if (restante > 0) {
          return {
            ok: false as const,
            error: `El cliente no tiene ${abs} u. pendientes de "${prod.nombre}" en consignación.`,
          };
        }
      }

      // ── Ingreso y costo del ítem (todo sin IVA, spec v1.2 §1.5) ──
      const precio = it.precioNeto ?? 0;
      const ing = regla.impacto === "ingreso" ? round2(abs * precio) : 0;
      if (regla.pidePrecio && data.medioPago === "credito") {
        totalCredito += abs * precio;
      }
      let costo = 0;
      if (regla.generaCosto) {
        if (
          regla.deposito === "resta" ||
          regla.consig === "vender" ||
          (regla.deposito === "ajuste" && it.cantidad < 0) ||
          regla.impacto === "co_branding"
        ) {
          costo = round2(abs * ppp);
        }
      }

      const [item] = await tx
        .insert(movimientoItems)
        .values({
          movimientoId: mov.id,
          productoId: it.productoId,
          cantidad: it.cantidad,
          precioNeto: regla.pidePrecio ? String(round2(precio)) : null,
          ingresoNeto: String(ing),
          costo: String(costo),
          consignacionId: consignacionRef,
        })
        .returning({ id: movimientoItems.id });

      for (const t of tomasLote) {
        await tx.insert(movimientoItemLotes).values({
          itemId: item.id,
          loteId: t.loteId,
          cantidad: t.cantidad,
        });
      }
    }

    // Venta a crédito: queda en la cuenta corriente del cliente.
    if (totalCredito > 0 && clienteId) {
      await tx.insert(ccMovimientos).values({
        entidadTipo: "cliente",
        entidadId: clienteId,
        fecha: data.fecha,
        concepto: `${TIPO_LABEL[data.tipo]} a crédito`,
        debe: String(round2(totalCredito)),
        haber: "0",
        origen: "venta_credito",
        medioPago: "credito",
        movimientoId: mov.id,
        creadoPor: actorId,
      });
    }

    // Asiento contable de partida doble.
    await generarAsientoMovimiento(tx, mov.id, actorId);

    return { ok: true as const, id: mov.id, clienteId };
  });

  if (!result.ok) return result;

  await registrarAuditoria({
    actorId,
    accion: "crear",
    entidad: "movimiento",
    entidadId: result.id,
    datos: { tipo: data.tipo, items: data.items.length },
  });

  revalidar();
  if (result.clienteId) revalidatePath(`/clientes/${result.clienteId}`);
  return { ok: true, id: result.id };
}

/**
 * Reversa stock/consignaciones/CC/asiento de un movimiento vigente sin
 * factura. No borra los ítems (quedan como registro histórico de lo que
 * tenía) — eso lo maneja el llamador según corresponda (editar los
 * reemplaza, anular los deja como están).
 */
async function reversarEfectos(
  tx: Tx,
  movimientoId: string,
  tipoOriginal: TipoManual,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const regla = reglaDe(tipoOriginal);
  const items = await tx
    .select({
      id: movimientoItems.id,
      productoId: movimientoItems.productoId,
      consignacionId: movimientoItems.consignacionId,
      cantidad: movimientoItems.cantidad,
    })
    .from(movimientoItems)
    .where(eq(movimientoItems.movimientoId, movimientoId));

  for (const it of items) {
    const tomas = await tx
      .select({ loteId: movimientoItemLotes.loteId, cantidad: movimientoItemLotes.cantidad })
      .from(movimientoItemLotes)
      .where(eq(movimientoItemLotes.itemId, it.id));

    if (regla.consig === "entregar") {
      const cons = await tx.query.consignaciones.findMany({
        where: eq(consignaciones.movimientoOrigenId, movimientoId),
      });
      if (cons.some((c) => c.vendidas > 0 || c.devueltas > 0)) {
        return {
          ok: false,
          error: "No se puede editar/anular: parte de esta consignación ya se vendió o devolvió.",
        };
      }
      for (const c of cons) await tx.delete(consignaciones).where(eq(consignaciones.id, c.id));
      for (const t of tomas) {
        await tx
          .update(stockLotes)
          .set({ unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} + ${t.cantidad}` })
          .where(and(eq(stockLotes.productoId, it.productoId), eq(stockLotes.loteId, t.loteId)));
      }
    } else if (regla.consig === "vender" && it.consignacionId) {
      const total = tomas.reduce((a, t) => a + t.cantidad, 0);
      await tx
        .update(consignaciones)
        .set({ vendidas: sql`${consignaciones.vendidas} - ${total}` })
        .where(eq(consignaciones.id, it.consignacionId));
    } else if (regla.consig === "devolver" && it.consignacionId) {
      const total = tomas.reduce((a, t) => a + t.cantidad, 0);
      await tx
        .update(consignaciones)
        .set({ devueltas: sql`${consignaciones.devueltas} - ${total}` })
        .where(eq(consignaciones.id, it.consignacionId));
      for (const t of tomas) {
        await tx
          .update(stockLotes)
          .set({ unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} - ${t.cantidad}` })
          .where(and(eq(stockLotes.productoId, it.productoId), eq(stockLotes.loteId, t.loteId)));
      }
    } else if (regla.deposito === "resta" || (regla.deposito === "ajuste" && it.cantidad < 0)) {
      for (const t of tomas) {
        await tx
          .update(stockLotes)
          .set({ unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} + ${t.cantidad}` })
          .where(and(eq(stockLotes.productoId, it.productoId), eq(stockLotes.loteId, t.loteId)));
      }
    } else if (regla.deposito === "ajuste" && it.cantidad > 0) {
      for (const t of tomas) {
        await tx
          .update(stockLotes)
          .set({ unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} - ${t.cantidad}` })
          .where(and(eq(stockLotes.productoId, it.productoId), eq(stockLotes.loteId, t.loteId)));
      }
    }
  }

  await tx.delete(ccMovimientos).where(eq(ccMovimientos.movimientoId, movimientoId));
  const asientosViejos = await tx
    .select({ id: asientos.id })
    .from(asientos)
    .where(eq(asientos.movimientoId, movimientoId));
  for (const a of asientosViejos) {
    await tx.delete(asientoLineas).where(eq(asientoLineas.asientoId, a.id));
    await tx.delete(asientos).where(eq(asientos.id, a.id));
  }

  return { ok: true };
}

/**
 * Anula un movimiento sin factura: reversa stock/consignaciones/asiento y
 * lo marca "anulado" (no se borra, queda trazable — adenda v1.3 §2.3).
 */
export async function anularMovimiento(id: string): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const mov = await db.query.movimientos.findFirst({ where: eq(movimientos.id, id) });
  if (!mov) return { ok: false, error: "No encontré el movimiento." };
  if (mov.tipo === "produccion") {
    return { ok: false, error: "Este movimiento sale de una orden de producción. Anulá la orden." };
  }
  if (mov.estado !== "vigente") {
    return { ok: false, error: "Este movimiento ya está anulado o tiene nota de crédito." };
  }
  const factura = await facturaDeMovimiento(id);
  if (factura) {
    return {
      ok: false,
      error: "Este movimiento tiene factura emitida — no se puede anular. Emití una nota de crédito.",
    };
  }

  const result = await db.transaction(async (tx) => {
    const rev = await reversarEfectos(tx, id, mov.tipo as TipoManual);
    if (!rev.ok) return rev;
    await tx.update(movimientos).set({ estado: "anulado" }).where(eq(movimientos.id, id));
    return { ok: true as const };
  });
  if (!result.ok) return result;

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "movimiento",
    entidadId: id,
    datos: { accion: "anular", tipo: mov.tipo },
  });

  revalidar();
  revalidatePath(`/movimientos/${id}`);
  return { ok: true, id };
}

export type EditarMovimientoInput = {
  fecha: string;
  tipo: TipoManual;
  clienteId: string;
  medioPago?: string | null;
  loteId?: string | null;
  observaciones?: string | null;
  items: { productoId: string; cantidad: number; precioNeto?: number }[];
};

/**
 * Edita un movimiento sin factura, con recálculo de stock/FIFO/costo
 * (adenda v1.3 §2.1). Acotado por ahora a tipos que no tocan consignaciones
 * (venta, canje, ajuste, etc.) — venta_consignacion/consignacion/devolución
 * se anulan y se cargan de nuevo.
 */
export async function editarMovimiento(
  id: string,
  input: EditarMovimientoInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const mov = await db.query.movimientos.findFirst({ where: eq(movimientos.id, id) });
  if (!mov) return { ok: false, error: "No encontré el movimiento." };
  if (mov.tipo === "produccion") {
    return { ok: false, error: "Este movimiento sale de producción, no se edita acá." };
  }
  if (mov.estado !== "vigente") {
    return { ok: false, error: "Este movimiento no está vigente." };
  }
  const factura = await facturaDeMovimiento(id);
  if (factura) {
    return {
      ok: false,
      error: "Este movimiento tiene factura emitida — lo que está en la factura no se puede editar. Emití una nota de crédito.",
    };
  }

  const oldTipo = mov.tipo as TipoManual;
  if (!EDITABLES_CON_RECALCULO.has(oldTipo) || !EDITABLES_CON_RECALCULO.has(input.tipo)) {
    return {
      ok: false,
      error: "Este tipo de movimiento (consignación) todavía no se edita acá — anulalo y cargá uno nuevo.",
    };
  }
  if ((input.tipo === "ajuste") !== (oldTipo === "ajuste")) {
    return { ok: false, error: "No se puede convertir un ajuste en otro tipo de movimiento (ni al revés)." };
  }

  const regla: Regla = reglaDe(input.tipo);
  if (regla.tercero === "cliente_req" && !input.clienteId) {
    return { ok: false, error: "Este tipo de movimiento requiere un cliente." };
  }
  if (regla.pideMedioPago && !input.medioPago) {
    return { ok: false, error: "La venta requiere un medio de pago." };
  }
  if (!input.items.length) return { ok: false, error: "Agregá al menos un ítem." };
  for (const it of input.items) {
    if (input.tipo === "ajuste") {
      if (it.cantidad === 0) return { ok: false, error: "La cantidad del ajuste no puede ser 0." };
    } else if (it.cantidad <= 0) {
      return { ok: false, error: "Las cantidades deben ser mayores a 0." };
    }
  }
  if (input.tipo === "ajuste" && input.items.some((i) => i.cantidad > 0) && !input.loteId) {
    return { ok: false, error: "Un ajuste que suma stock necesita indicar el lote." };
  }

  const antes = {
    fecha: mov.fecha,
    tipo: TIPO_LABEL[oldTipo],
    clienteId: mov.clienteId,
    medioPago: mov.medioPago,
    observaciones: mov.observaciones,
  };

  const result = await db.transaction(async (tx) => {
    const rev = await reversarEfectos(tx, id, oldTipo);
    if (!rev.ok) return rev;

    await tx.delete(movimientoItems).where(eq(movimientoItems.movimientoId, id));

    await tx
      .update(movimientos)
      .set({
        fecha: input.fecha,
        tipo: input.tipo,
        clienteId: input.clienteId || null,
        medioPago: regla.pideMedioPago ? (input.medioPago as never) : null,
        observaciones: input.observaciones || null,
      })
      .where(eq(movimientos.id, id));

    let totalCredito = 0;
    for (const it of input.items) {
      const prod = await tx.query.productos.findFirst({
        where: eq(productos.id, it.productoId),
        columns: { ppp: true, nombre: true, esInsumo: true },
      });
      if (!prod || prod.esInsumo) return { ok: false as const, error: "Ítem con producto inválido." };
      const ppp = Number(prod.ppp);
      const abs = Math.abs(it.cantidad);
      const tomasLote: { loteId: string; cantidad: number }[] = [];

      if (regla.deposito === "resta" || (regla.deposito === "ajuste" && it.cantidad < 0)) {
        const disp = await tx.query.stockLotes.findMany({
          where: eq(stockLotes.productoId, it.productoId),
          with: { lote: { columns: { fecha: true } } },
        });
        disp.sort((a, b) => a.lote.fecha.localeCompare(b.lote.fecha));
        const { tomas, faltante } = tomarFifo(
          disp.map((d) => ({ loteId: d.loteId, unidades: d.unidadesEnDeposito })),
          abs,
        );
        if (faltante > 0) {
          return {
            ok: false as const,
            error: `Stock insuficiente en depósito de "${prod.nombre}" (faltan ${faltante}).`,
          };
        }
        for (const t of tomas) {
          await tx
            .update(stockLotes)
            .set({ unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} - ${t.cantidad}` })
            .where(and(eq(stockLotes.productoId, it.productoId), eq(stockLotes.loteId, t.loteId)));
          tomasLote.push(t);
        }
      } else if (regla.deposito === "ajuste" && it.cantidad > 0) {
        const existe = await tx
          .select({ u: stockLotes.unidadesEnDeposito })
          .from(stockLotes)
          .where(and(eq(stockLotes.productoId, it.productoId), eq(stockLotes.loteId, input.loteId!)));
        if (existe.length) {
          await tx
            .update(stockLotes)
            .set({ unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} + ${abs}` })
            .where(and(eq(stockLotes.productoId, it.productoId), eq(stockLotes.loteId, input.loteId!)));
        } else {
          await tx
            .insert(stockLotes)
            .values({ productoId: it.productoId, loteId: input.loteId!, unidadesEnDeposito: abs });
        }
        tomasLote.push({ loteId: input.loteId!, cantidad: abs });
      }

      const precio = it.precioNeto ?? 0;
      const ing = regla.impacto === "ingreso" ? round2(abs * precio) : 0;
      if (regla.pidePrecio && input.medioPago === "credito") totalCredito += abs * precio;
      let costo = 0;
      if (regla.generaCosto) {
        if (
          regla.deposito === "resta" ||
          (regla.deposito === "ajuste" && it.cantidad < 0) ||
          regla.impacto === "co_branding"
        ) {
          costo = round2(abs * ppp);
        }
      }

      const [item] = await tx
        .insert(movimientoItems)
        .values({
          movimientoId: id,
          productoId: it.productoId,
          cantidad: it.cantidad,
          precioNeto: regla.pidePrecio ? String(round2(precio)) : null,
          ingresoNeto: String(ing),
          costo: String(costo),
          consignacionId: null,
        })
        .returning({ id: movimientoItems.id });

      for (const t of tomasLote) {
        await tx.insert(movimientoItemLotes).values({ itemId: item.id, loteId: t.loteId, cantidad: t.cantidad });
      }
    }

    if (totalCredito > 0 && input.clienteId) {
      await tx.insert(ccMovimientos).values({
        entidadTipo: "cliente",
        entidadId: input.clienteId,
        fecha: input.fecha,
        concepto: `${TIPO_LABEL[input.tipo]} a crédito (editado)`,
        debe: String(round2(totalCredito)),
        haber: "0",
        origen: "venta_credito",
        medioPago: "credito",
        movimientoId: id,
        creadoPor: user.id,
      });
    }

    await generarAsientoMovimiento(tx, id, user.id);

    return { ok: true as const };
  });
  if (!result.ok) return result;

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "movimiento",
    entidadId: id,
    datos: {
      antes,
      despues: {
        fecha: input.fecha,
        tipo: TIPO_LABEL[input.tipo],
        clienteId: input.clienteId || null,
        medioPago: input.medioPago,
        observaciones: input.observaciones,
      },
      items: input.items.length,
    },
  });

  revalidar();
  revalidatePath(`/movimientos/${id}`);
  return { ok: true, id };
}

/**
 * Edita medio de pago / observaciones — siempre disponible, incluso con
 * factura emitida (no es parte del comprobante, adenda v1.3 §2.2).
 */
export async function editarCamposLibres(
  id: string,
  input: { medioPago?: string | null; observaciones?: string | null },
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);
  const mov = await db.query.movimientos.findFirst({ where: eq(movimientos.id, id) });
  if (!mov) return { ok: false, error: "No encontré el movimiento." };
  if (mov.estado === "anulado") return { ok: false, error: "Este movimiento está anulado." };

  await db
    .update(movimientos)
    .set({
      medioPago: (input.medioPago as never) ?? mov.medioPago,
      observaciones: input.observaciones ?? null,
    })
    .where(eq(movimientos.id, id));

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "movimiento",
    entidadId: id,
    datos: { antes: { medioPago: mov.medioPago, observaciones: mov.observaciones }, despues: input },
  });

  revalidar();
  revalidatePath(`/movimientos/${id}`);
  return { ok: true, id };
}

/**
 * Reasigna un ítem a otro lote con stock (trazabilidad interna, no fiscal
 * — solo admin, adenda v1.3 §2). Acotado a ítems que tomaron de un único
 * lote; si tomó de varios, no se puede reasignar desde acá.
 */
export async function reasignarLote(
  itemId: string,
  nuevoLoteId: string,
): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const item = await db.query.movimientoItems.findFirst({ where: eq(movimientoItems.id, itemId) });
  if (!item) return { ok: false, error: "No encontré el ítem." };

  const tomas = await db
    .select({ id: movimientoItemLotes.id, loteId: movimientoItemLotes.loteId, cantidad: movimientoItemLotes.cantidad })
    .from(movimientoItemLotes)
    .where(eq(movimientoItemLotes.itemId, itemId));
  if (tomas.length !== 1) {
    return { ok: false, error: "Este ítem tomó stock de varios lotes — no se puede reasignar desde acá." };
  }
  const toma = tomas[0];
  if (toma.loteId === nuevoLoteId) return { ok: true, id: item.movimientoId };

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(stockLotes)
        .set({ unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} + ${toma.cantidad}` })
        .where(and(eq(stockLotes.productoId, item.productoId), eq(stockLotes.loteId, toma.loteId)));

      const existe = await tx
        .select({ u: stockLotes.unidadesEnDeposito })
        .from(stockLotes)
        .where(and(eq(stockLotes.productoId, item.productoId), eq(stockLotes.loteId, nuevoLoteId)));
      if (existe.length) {
        if (existe[0].u < toma.cantidad) {
          throw new Error("No hay stock suficiente en el lote de destino.");
        }
        await tx
          .update(stockLotes)
          .set({ unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} - ${toma.cantidad}` })
          .where(and(eq(stockLotes.productoId, item.productoId), eq(stockLotes.loteId, nuevoLoteId)));
      } else {
        throw new Error("El lote de destino no tiene stock de este producto.");
      }

      await tx.update(movimientoItemLotes).set({ loteId: nuevoLoteId }).where(eq(movimientoItemLotes.id, toma.id));
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo reasignar el lote." };
  }

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "movimiento",
    entidadId: item.movimientoId,
    datos: { accion: "reasignar_lote", itemId, loteAnterior: toma.loteId, loteNuevo: nuevoLoteId },
  });

  revalidar();
  revalidatePath(`/movimientos/${item.movimientoId}`);
  return { ok: true, id: item.movimientoId };
}

export async function eliminarMovimiento(id: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  const mov = await db.query.movimientos.findFirst({
    where: eq(movimientos.id, id),
  });
  if (!mov) return { ok: false, error: "No encontré el movimiento." };
  if (mov.tipo === "produccion") {
    return {
      ok: false,
      error: "Este movimiento sale de una orden de producción. Anulá la orden.",
    };
  }
  return {
    ok: false,
    error:
      "Eliminar movimientos manuales todavía no está implementado en Fase 4.",
  };
}
