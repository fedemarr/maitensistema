"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
import { generarAsientoMovimiento } from "@/features/finanzas/lib/posting";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { ingresoNeto, round2, tomarFifo } from "@/lib/stock";
import {
  movimientoInput,
  reglaDe,
  TIPO_LABEL,
  type MovimientoInput,
} from "./schema";

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
        observaciones: data.observaciones,
        creadoPor: user.id,
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

      // ── Ingreso y costo del ítem ──
      const precio = it.precioConIva ?? 0;
      const ing =
        regla.impacto === "ingreso" ? round2(ingresoNeto(abs, precio)) : 0;
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
          precioConIva: regla.pidePrecio ? String(round2(precio)) : null,
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
        creadoPor: user.id,
      });
    }

    // Asiento contable de partida doble.
    await generarAsientoMovimiento(tx, mov.id, user.id);

    return { ok: true as const, id: mov.id, clienteId };
  });

  if (!result.ok) return result;

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "movimiento",
    entidadId: result.id,
    datos: { tipo: data.tipo, items: data.items.length },
  });

  revalidar();
  if (result.clienteId) revalidatePath(`/clientes/${result.clienteId}`);
  return { ok: true, id: result.id };
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
