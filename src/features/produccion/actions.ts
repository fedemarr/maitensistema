"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  asientos,
  bajasInsumo,
  compraInsumoLineas,
  comprasInsumo,
  lotes,
  minimoCompraFabrica,
  movimientoItemLotes,
  movimientoItems,
  movimientos,
  ordenLineas,
  ordenesProduccion,
  preciosFabricacion,
  productos,
  recetas,
  stockLotes,
} from "@/db/schema";
import {
  generarAsientoBaja,
  generarAsientoProduccion,
} from "@/features/finanzas/lib/posting";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { pppMovil, round2, round4 } from "@/lib/stock";
import {
  getOrdenParaCerrar,
  minimoVigente,
  precioFabricacionVigente,
} from "./queries";
import {
  cerrarOrdenInput,
  planificarInput,
  vigenciaMinimoInput,
  vigenciaPrecioFabInput,
  type CerrarOrdenInput,
  type PlanificarInput,
  type VigenciaMinimoInput,
  type VigenciaPrecioFabInput,
} from "./schema";

/** Wrapper server-action de la query de cierre (para usar desde el cliente). */
export async function getOrdenCierre(id: string) {
  await requireRole(["admin", "ventas"]);
  return getOrdenParaCerrar(id);
}

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const revalidar = () => {
  revalidatePath("/produccion");
  revalidatePath("/produccion/fabrica");
  revalidatePath("/insumos");
  revalidatePath("/stock");
  revalidatePath("/movimientos");
  revalidatePath("/productos");
  revalidatePath("/finanzas");
  revalidatePath("/");
};

/** Día anterior a `fecha` (YYYY-MM-DD). */
function diaAnterior(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function planificarOrden(
  input: PlanificarInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = planificarInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const receta = await db.query.recetas.findFirst({
    where: and(
      eq(recetas.productoId, data.productoId),
      isNull(recetas.vigenteHasta),
    ),
    with: { lineas: { with: { insumo: { columns: { ppp: true } } } } },
  });
  if (!receta) {
    return {
      ok: false,
      error: "El producto no tiene receta vigente. Cargala desde su ficha.",
    };
  }
  if (!data.loteId && !data.nuevoLoteNombre) {
    return { ok: false, error: "Elegí un lote o creá uno nuevo." };
  }

  // Precio y mínimo se toman del tarifario vigente a la fecha de la orden.
  const precioUnit = await precioFabricacionVigente(
    data.productoId,
    data.fechaPrevista,
  );
  if (precioUnit == null) {
    return {
      ok: false,
      error:
        "El producto no tiene precio de fabricación cargado. Cargalo en Producción → Fábrica.",
    };
  }
  const minimo = await minimoVigente(data.fechaPrevista);
  const cotizada = round2(precioUnit * data.cantidad);

  const ordenId = await db.transaction(async (tx) => {
    let loteId = data.loteId;
    if (!loteId && data.nuevoLoteNombre) {
      const [l] = await tx
        .insert(lotes)
        .values({ nombre: data.nuevoLoteNombre, fecha: data.fechaPrevista })
        .returning({ id: lotes.id });
      loteId = l.id;
    }

    const [orden] = await tx
      .insert(ordenesProduccion)
      .values({
        productoId: data.productoId,
        loteId: loteId!,
        recetaId: receta.id,
        estado: "planificada",
        fechaPrevista: data.fechaPrevista,
        unidadesPlanificadas: data.cantidad,
        precioFabricacionUnitario: String(round2(precioUnit)),
        minimoCompraAplicado: String(round2(minimo?.monto ?? 0)),
        minimoCompraId: minimo?.id ?? null,
        fabricacionCotizada: String(cotizada),
        creadoPor: user.id,
      })
      .returning({ id: ordenesProduccion.id });

    await tx.insert(ordenLineas).values(
      receta.lineas.map((l) => {
        const estandar = Number(l.cantidadPorUnidad);
        return {
          ordenId: orden.id,
          insumoId: l.insumoId,
          cantidadEstandar: String(round4(estandar)),
          consumoTeorico: String(round4(estandar * data.cantidad)),
          pppAlCierre: null,
        };
      }),
    );

    return orden.id;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "orden_produccion",
    entidadId: ordenId,
    datos: { productoId: data.productoId, cantidad: data.cantidad },
  });

  revalidar();
  return { ok: true, id: ordenId };
}

export async function cerrarOrden(
  input: CerrarOrdenInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = cerrarOrdenInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const orden = await db.query.ordenesProduccion.findFirst({
    where: eq(ordenesProduccion.id, data.ordenId),
    with: { lineas: true },
  });
  if (!orden) return { ok: false, error: "No encontré la orden." };
  if (orden.estado !== "planificada") {
    return { ok: false, error: "La orden ya está cerrada o anulada." };
  }

  const consumoPorInsumo = new Map(
    data.consumos.map((c) => [c.insumoId, c.consumoReal]),
  );

  const result = await db.transaction(async (tx) => {
    const hoy = new Date().toISOString().slice(0, 10);
    let costoMp = 0;
    let desvioMp = 0;

    // 1. Consumo real por insumo: valida stock, actualiza línea y descuenta.
    for (const linea of orden.lineas) {
      const real = consumoPorInsumo.get(linea.insumoId) ?? 0;
      const insumo = await tx.query.productos.findFirst({
        where: eq(productos.id, linea.insumoId),
        columns: { stockInsumo: true, ppp: true, nombre: true },
      });
      if (!insumo) {
        return { ok: false as const, error: "Un insumo ya no existe." };
      }
      const stock = Number(insumo.stockInsumo);
      if (real > stock + 1e-6) {
        return {
          ok: false as const,
          error: `Consumo mayor al stock de "${insumo.nombre}" (hay ${stock}).`,
        };
      }
      const ppp = Number(insumo.ppp);
      const teorico = Number(linea.consumoTeorico);
      const desvioFisico = real - teorico;
      const desvioMonto = desvioFisico * ppp;
      costoMp += real * ppp;
      desvioMp += desvioMonto;

      await tx
        .update(ordenLineas)
        .set({
          consumoReal: String(round4(real)),
          pppAlCierre: String(round2(ppp)),
          desvioFisico: String(round4(desvioFisico)),
          desvioMonto: String(round2(desvioMonto)),
        })
        .where(eq(ordenLineas.id, linea.id));

      await tx
        .update(productos)
        .set({
          stockInsumo: sql`greatest(0, ${productos.stockInsumo} - ${round4(real)})`,
        })
        .where(eq(productos.id, linea.insumoId));
    }

    // 2. Sobrantes NO reutilizables comprados para este lote → baja automática.
    const insumoIds = orden.lineas.map((l) => l.insumoId);
    const infoInsumos = await tx
      .select({
        id: productos.id,
        nombre: productos.nombre,
        reutilizable: productos.reutilizable,
        ppp: productos.ppp,
      })
      .from(productos)
      .where(inArray(productos.id, insumoIds));

    const comprado = await tx
      .select({
        insumoId: compraInsumoLineas.insumoId,
        total: sql<number>`coalesce(sum(${compraInsumoLineas.cantidad}), 0)`,
      })
      .from(compraInsumoLineas)
      .innerJoin(
        comprasInsumo,
        eq(compraInsumoLineas.compraId, comprasInsumo.id),
      )
      .where(
        and(
          eq(comprasInsumo.loteId, orden.loteId),
          inArray(compraInsumoLineas.insumoId, insumoIds),
        ),
      )
      .groupBy(compraInsumoLineas.insumoId);
    const compradoMap = new Map(
      comprado.map((c) => [c.insumoId, Number(c.total)]),
    );

    let bajasAuto = 0;
    const bajasAutoIds: string[] = [];
    for (const info of infoInsumos) {
      if (info.reutilizable) continue;
      const comp = compradoMap.get(info.id) ?? 0;
      if (comp <= 0) continue;
      const yaBaja = await tx
        .select({ id: bajasInsumo.id })
        .from(bajasInsumo)
        .where(
          and(
            eq(bajasInsumo.insumoId, info.id),
            eq(bajasInsumo.loteId, orden.loteId),
            sql`${bajasInsumo.ordenId} is not null`,
          ),
        )
        .limit(1);
      if (yaBaja.length) continue;

      const consumidoTotal = consumoPorInsumo.get(info.id) ?? 0;
      const sobrante = round4(comp - consumidoTotal);
      if (sobrante <= 0) continue;

      const monto = round2(sobrante * Number(info.ppp));
      const [b] = await tx
        .insert(bajasInsumo)
        .values({
          fecha: hoy,
          insumoId: info.id,
          cantidad: String(sobrante),
          motivo: "no_reutilizable",
          monto: String(monto),
          loteId: orden.loteId,
          ordenId: orden.id,
          creadoPor: user.id,
        })
        .returning({ id: bajasInsumo.id });
      bajasAutoIds.push(b.id);
      await tx
        .update(productos)
        .set({
          stockInsumo: sql`greatest(0, ${productos.stockInsumo} - ${sobrante})`,
        })
        .where(eq(productos.id, info.id));
      bajasAuto++;
    }

    // 3. Costos y desvíos.
    const cotizada = Number(orden.fabricacionCotizada);
    const costoTotal = costoMp + data.fabricacionCobrada;
    const costoUnitario = costoTotal / data.unidadesObtenidas;
    const desvioFabricacion = data.fabricacionCobrada - cotizada;

    // 4. Puente Producción → Stock: movimiento de entrada `produccion`.
    const [mov] = await tx
      .insert(movimientos)
      .values({
        fecha: orden.fechaPrevista,
        tipo: "produccion",
        observaciones: `Orden de producción ${orden.id.slice(0, 8)}`,
        creadoPor: user.id,
      })
      .returning({ id: movimientos.id });

    const [item] = await tx
      .insert(movimientoItems)
      .values({
        movimientoId: mov.id,
        productoId: orden.productoId,
        cantidad: data.unidadesObtenidas,
        ingresoNeto: "0",
        costo: String(round2(costoTotal)),
      })
      .returning({ id: movimientoItems.id });

    await tx.insert(movimientoItemLotes).values({
      itemId: item.id,
      loteId: orden.loteId,
      cantidad: data.unidadesObtenidas,
    });

    // Stock por lote (upsert).
    const existente = await tx
      .select({ u: stockLotes.unidadesEnDeposito })
      .from(stockLotes)
      .where(
        and(
          eq(stockLotes.productoId, orden.productoId),
          eq(stockLotes.loteId, orden.loteId),
        ),
      )
      .limit(1);
    if (existente.length) {
      await tx
        .update(stockLotes)
        .set({
          unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} + ${data.unidadesObtenidas}`,
        })
        .where(
          and(
            eq(stockLotes.productoId, orden.productoId),
            eq(stockLotes.loteId, orden.loteId),
          ),
        );
    } else {
      await tx.insert(stockLotes).values({
        productoId: orden.productoId,
        loteId: orden.loteId,
        unidadesEnDeposito: data.unidadesObtenidas,
      });
    }

    // PPP móvil del terminado (sobre el stock previo total).
    const stockPrevioRows = await tx
      .select({ u: stockLotes.unidadesEnDeposito })
      .from(stockLotes)
      .where(eq(stockLotes.productoId, orden.productoId));
    const stockPrevio =
      stockPrevioRows.reduce((a, r) => a + r.u, 0) - data.unidadesObtenidas;
    const prod = await tx.query.productos.findFirst({
      where: eq(productos.id, orden.productoId),
      columns: { ppp: true },
    });
    const nuevoPpp = pppMovil(
      Math.max(0, stockPrevio),
      Number(prod?.ppp ?? 0),
      data.unidadesObtenidas,
      costoTotal,
    );
    await tx
      .update(productos)
      .set({ ppp: String(round2(nuevoPpp)) })
      .where(eq(productos.id, orden.productoId));

    // 5. Cerrar la orden con sus resultados.
    await tx
      .update(ordenesProduccion)
      .set({
        estado: "cerrada",
        fechaCierre: hoy,
        unidadesObtenidas: data.unidadesObtenidas,
        fabricacionCobrada: String(round2(data.fabricacionCobrada)),
        costoMp: String(round2(costoMp)),
        costoTotal: String(round2(costoTotal)),
        costoUnitario: String(round2(costoUnitario)),
        desvioMp: String(round2(desvioMp)),
        desvioFabricacion: String(round2(desvioFabricacion)),
        movimientoEntradaId: mov.id,
      })
      .where(eq(ordenesProduccion.id, orden.id));

    // 6. Asientos contables: fabricación + bajas automáticas de sobrantes.
    await generarAsientoProduccion(tx, orden.id, user.id);
    for (const bajaId of bajasAutoIds) {
      await generarAsientoBaja(tx, bajaId, user.id);
    }

    return {
      ok: true as const,
      id: orden.id,
      bajasAuto,
      costoUnitario,
    };
  });

  if (!result.ok) return result;

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "orden_produccion",
    entidadId: orden.id,
    datos: {
      estado: "cerrada",
      unidadesObtenidas: data.unidadesObtenidas,
      bajasAuto: result.bajasAuto,
    },
  });

  revalidar();
  return { ok: true, id: orden.id };
}

/** Anula una orden. Planificada: sin efecto. Cerrada (admin): revierte todo. */
export async function anularOrden(id: string): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const orden = await db.query.ordenesProduccion.findFirst({
    where: eq(ordenesProduccion.id, id),
    with: { lineas: true },
  });
  if (!orden) return { ok: false, error: "No encontré la orden." };

  if (orden.estado === "planificada") {
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
    revalidar();
    return { ok: true, id };
  }

  if (orden.estado !== "cerrada" || !orden.movimientoEntradaId) {
    return { ok: false, error: "La orden no se puede anular en este estado." };
  }

  const result = await db.transaction(async (tx) => {
    // Revertir stock del terminado (no puede quedar negativo).
    const st = await tx
      .select({ u: stockLotes.unidadesEnDeposito })
      .from(stockLotes)
      .where(
        and(
          eq(stockLotes.productoId, orden.productoId),
          eq(stockLotes.loteId, orden.loteId),
        ),
      )
      .limit(1);
    const obt = orden.unidadesObtenidas ?? 0;
    if (!st.length || st[0].u < obt) {
      return {
        ok: false as const,
        error:
          "Ya se consumieron unidades producidas por esta orden. No se puede anular.",
      };
    }
    await tx
      .update(stockLotes)
      .set({
        unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} - ${obt}`,
      })
      .where(
        and(
          eq(stockLotes.productoId, orden.productoId),
          eq(stockLotes.loteId, orden.loteId),
        ),
      );

    // Devolver el consumo de insumos.
    for (const l of orden.lineas) {
      const real = Number(l.consumoReal ?? 0);
      if (real > 0) {
        await tx
          .update(productos)
          .set({ stockInsumo: sql`${productos.stockInsumo} + ${round4(real)}` })
          .where(eq(productos.id, l.insumoId));
      }
    }

    // Deshacer las bajas automáticas de esta orden.
    const auto = await tx
      .select()
      .from(bajasInsumo)
      .where(eq(bajasInsumo.ordenId, orden.id));
    for (const b of auto) {
      await tx
        .update(productos)
        .set({
          stockInsumo: sql`${productos.stockInsumo} + ${Number(b.cantidad)}`,
        })
        .where(eq(productos.id, b.insumoId));
    }
    await tx.delete(bajasInsumo).where(eq(bajasInsumo.ordenId, orden.id));

    // Borrar el asiento de fabricación (los de las bajas se van en cascada).
    await tx.delete(asientos).where(eq(asientos.ordenId, orden.id));

    // Borrar el movimiento de entrada (cascada a items y item_lotes).
    await tx
      .delete(movimientos)
      .where(eq(movimientos.id, orden.movimientoEntradaId!));

    await tx
      .update(ordenesProduccion)
      .set({ estado: "anulada", movimientoEntradaId: null })
      .where(eq(ordenesProduccion.id, orden.id));

    return { ok: true as const };
  });

  if (!result.ok) return result;

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "orden_produccion",
    entidadId: id,
    datos: { estado: "anulada", revirtioMovimiento: orden.movimientoEntradaId },
  });

  revalidar();
  return { ok: true, id };
}

/* ── Fábrica: tarifario y mínimo (spec v1.2 §3.3) ─────────── */

/** Agrega una vigencia nueva del precio de fabricación de un producto (no pisa la anterior). */
export async function agregarVigenciaPrecioFab(
  input: VigenciaPrecioFabInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = vigenciaPrecioFabInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const id = await db.transaction(async (tx) => {
    const vigente = await tx
      .select({ id: preciosFabricacion.id })
      .from(preciosFabricacion)
      .where(
        and(
          eq(preciosFabricacion.productoId, data.productoId),
          isNull(preciosFabricacion.vigenteHasta),
        ),
      )
      .limit(1);
    if (vigente[0]) {
      await tx
        .update(preciosFabricacion)
        .set({ vigenteHasta: diaAnterior(data.vigenteDesde) })
        .where(eq(preciosFabricacion.id, vigente[0].id));
    }
    const [row] = await tx
      .insert(preciosFabricacion)
      .values({
        productoId: data.productoId,
        precioUnitario: String(round2(data.precioUnitario)),
        vigenteDesde: data.vigenteDesde,
        creadoPor: user.id,
      })
      .returning({ id: preciosFabricacion.id });
    return row.id;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "precio_fabricacion",
    entidadId: id,
    datos: { productoId: data.productoId, precioUnitario: data.precioUnitario },
  });

  revalidar();
  return { ok: true, id };
}

/** Agrega una vigencia nueva del mínimo de compra de la fábrica. */
export async function agregarVigenciaMinimo(
  input: VigenciaMinimoInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = vigenciaMinimoInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const id = await db.transaction(async (tx) => {
    const vigente = await tx
      .select({ id: minimoCompraFabrica.id })
      .from(minimoCompraFabrica)
      .where(isNull(minimoCompraFabrica.vigenteHasta))
      .limit(1);
    if (vigente[0]) {
      await tx
        .update(minimoCompraFabrica)
        .set({ vigenteHasta: diaAnterior(data.vigenteDesde) })
        .where(eq(minimoCompraFabrica.id, vigente[0].id));
    }
    const [row] = await tx
      .insert(minimoCompraFabrica)
      .values({
        monto: String(round2(data.monto)),
        vigenteDesde: data.vigenteDesde,
        creadoPor: user.id,
      })
      .returning({ id: minimoCompraFabrica.id });
    return row.id;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "minimo_compra_fabrica",
    entidadId: id,
    datos: { monto: data.monto },
  });

  revalidar();
  return { ok: true, id };
}
