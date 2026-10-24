"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { facturas, movimientoItemLotes, movimientoItems, movimientos, stockLotes, consignaciones } from "@/db/schema";
import { generarAsientoNotaCredito } from "@/features/finanzas/lib/posting";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { round2 } from "@/lib/stock";
import { enviarFacturaPorMail } from "./lib/mailer";
import { CBTE_TIPO, feCaeSolicitar, feCompUltimoAutorizado, feDummy } from "./lib/wsfe";
import {
  facturaDeMovimiento,
  movimientoParaFacturar,
  saldoFactura,
  type MovimientoParaFacturar,
} from "./queries";

export type ActionResult =
  | {
      ok: true;
      id: string;
      cae: string;
      numero: number;
      tipoComprobante: string;
      enviada: boolean;
      envioError?: string;
    }
  | { ok: false; error: string };

/** Chequeo de conectividad (no emite nada) — para el panel de Integraciones. */
export async function probarConexionAfip(): Promise<
  { ok: true; detalle: string } | { ok: false; error: string }
> {
  await requireRole(["admin"]);
  try {
    const r = await feDummy();
    const detalle = `App: ${r.appServer} · Db: ${r.dbServer} · Auth: ${r.authServer}`;
    if (r.appServer !== "OK" || r.dbServer !== "OK" || r.authServer !== "OK") {
      return { ok: false, error: `AFIP responde con problemas — ${detalle}` };
    }
    return { ok: true, detalle };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Fallo desconocido." };
  }
}

type Comprobante = {
  tipoComprobante: "A" | "B";
  cbteTipo: number;
  docTipo: number;
  docNro: string;
  condicionIvaReceptorId: number;
  advertencias: string[];
};

/** Deriva tipo de comprobante / doc del receptor a partir de los datos del
 * cliente. Lo usan tanto la previsualización (9.1) como la emisión real. */
function calcularComprobante(mov: MovimientoParaFacturar): Comprobante {
  const esRI = mov.clienteCondicionIva === "responsable_inscripto";
  const digitos = (mov.clienteCuit ?? "").replace(/\D/g, "");
  const docTipo = digitos.length === 11 ? 80 : digitos.length >= 7 && digitos.length <= 8 ? 96 : 99;
  const docNro = docTipo === 99 ? "0" : digitos;
  const condicionIvaReceptorId = mapConditionIva(mov.clienteCondicionIva);

  const advertencias: string[] = [];
  if (esRI && docTipo !== 80) {
    advertencias.push("El cliente es Responsable Inscripto pero no tiene un CUIT válido (11 dígitos) — no se puede emitir Factura A.");
  }
  if (!mov.clienteEmail) {
    advertencias.push("El cliente no tiene email cargado — la factura no se va a poder enviar sola.");
  }

  return {
    tipoComprobante: esRI ? "A" : "B",
    cbteTipo: esRI ? CBTE_TIPO.facturaA : CBTE_TIPO.facturaB,
    docTipo,
    docNro,
    condicionIvaReceptorId,
    advertencias,
  };
}

export type PrevisualizacionFactura = {
  movimientoId: string;
  tipoComprobante: string;
  clienteNombre: string | null;
  clienteDoc: string;
  clienteCondicionIva: string | null;
  clienteEmail: string | null;
  items: { producto: string; cantidad: number; precioNeto: number }[];
  importeNeto: number;
  importeIva: number;
  importeTotal: number;
  advertencias: string[];
  puedeEmitir: boolean;
};

/** Qué se va a emitir, sin pedir el CAE — para la confirmación de §9.1. */
export async function previsualizarFactura(
  movimientoId: string,
): Promise<PrevisualizacionFactura | { error: string }> {
  await requireRole(["admin", "ventas"]);

  const mov = await movimientoParaFacturar(movimientoId);
  if (!mov) return { error: "Este movimiento no es una venta facturable." };

  const movRow = await db.query.movimientos.findFirst({ where: eq(movimientos.id, movimientoId) });
  if (movRow && movRow.estado !== "vigente") {
    return { error: `Este movimiento está ${movRow.estado === "anulado" ? "anulado" : "con nota de crédito total"}.` };
  }

  const yaFacturado = await facturaDeMovimiento(movimientoId);
  if (yaFacturado) {
    return { error: `Ya está facturado: ${yaFacturado.tipoComprobante} N.º ${yaFacturado.numero}.` };
  }

  const c = calcularComprobante(mov);
  const docLabel = c.docTipo === 80 ? "CUIT" : c.docTipo === 96 ? "DNI" : "sin identificar";

  return {
    movimientoId,
    tipoComprobante: c.tipoComprobante,
    clienteNombre: mov.clienteNombre,
    clienteDoc: c.docTipo === 99 ? "Consumidor final sin identificar" : `${docLabel} ${c.docNro}`,
    clienteCondicionIva: mov.clienteCondicionIva,
    clienteEmail: mov.clienteEmail,
    items: mov.items.map((i) => ({ producto: i.producto, cantidad: i.cantidad, precioNeto: i.precioNeto })),
    importeNeto: mov.importeNeto,
    importeIva: mov.importeIva,
    importeTotal: mov.importeTotal,
    advertencias: c.advertencias,
    puedeEmitir: !c.advertencias.some((a) => a.includes("no se puede emitir")),
  };
}

/**
 * Emite la Factura A/B (AFIP/ARCA) de una venta ya cargada. Pide el CAE de
 * verdad — es una acción real e irreversible (si algo sale mal después de
 * emitido, se corrige con una Nota de Crédito, no se puede deshacer).
 */
export async function facturarMovimiento(movimientoId: string): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);
  return facturarMovimientoComo(movimientoId, user.id);
}

/**
 * Núcleo de la emisión, sin chequeo de rol — lo usa `facturarMovimiento`
 * (Server Action, con usuario logueado) y el webhook de Tiendanube (sin
 * sesión, `actorId: null`).
 */
export async function facturarMovimientoComo(
  movimientoId: string,
  actorId: string | null,
): Promise<ActionResult> {
  const mov = await movimientoParaFacturar(movimientoId);
  if (!mov) return { ok: false, error: "Este movimiento no es una venta facturable." };

  const movRow = await db.query.movimientos.findFirst({ where: eq(movimientos.id, movimientoId) });
  if (movRow && movRow.estado !== "vigente") {
    return { ok: false, error: "Este movimiento no está vigente (anulado o con nota de crédito)." };
  }

  const yaFacturado = await facturaDeMovimiento(movimientoId);
  if (yaFacturado) {
    return {
      ok: false,
      error: `Ya está facturado: ${yaFacturado.tipoComprobante} N.º ${yaFacturado.numero} (CAE ${yaFacturado.cae}).`,
    };
  }

  const c = calcularComprobante(mov);
  if (c.tipoComprobante === "A" && c.docTipo !== 80) {
    return { ok: false, error: "Para Factura A el cliente necesita un CUIT válido (11 dígitos)." };
  }

  const puntoVenta = Number(process.env.AFIP_PUNTO_VENTA ?? "0");
  if (!puntoVenta) return { ok: false, error: "Falta configurar AFIP_PUNTO_VENTA." };

  let numero: number;
  try {
    numero = (await feCompUltimoAutorizado(puntoVenta, c.cbteTipo)) + 1;
  } catch (e) {
    return { ok: false, error: `No se pudo consultar el último comprobante en AFIP: ${msg(e)}` };
  }

  const resultado = await feCaeSolicitar(
    puntoVenta,
    c.cbteTipo,
    numero,
    new Date().toISOString().slice(0, 10),
    {
      docTipo: c.docTipo,
      docNro: c.docNro,
      condicionIvaReceptorId: c.condicionIvaReceptorId,
      importeNeto: mov.importeNeto,
      importeIva: mov.importeIva,
      importeTotal: mov.importeTotal,
    },
  ).catch((e) => ({ ok: false as const, motivo: msg(e) }));

  if (!resultado.ok) {
    return { ok: false, error: resultado.motivo ?? "AFIP rechazó el comprobante." };
  }

  // D-25: congelar los datos del cliente tal cual estaban al momento de facturar.
  const snapshot = JSON.stringify({
    nombre: mov.clienteNombre,
    doc: c.docNro,
    condicionIva: mov.clienteCondicionIva,
  });

  const [row] = await db.transaction(async (tx) => {
    await tx.update(movimientos).set({ clienteSnapshot: snapshot }).where(eq(movimientos.id, movimientoId));
    return tx
      .insert(facturas)
      .values({
        movimientoId,
        puntoVenta,
        tipoComprobante: c.tipoComprobante,
        codigoComprobante: c.cbteTipo,
        numero: resultado.numero!,
        cae: resultado.cae!,
        caeVencimiento: resultado.caeVencimiento!,
        docTipo: c.docTipo,
        docNro: c.docNro,
        importeNeto: String(mov.importeNeto),
        importeIva: String(mov.importeIva),
        importeTotal: String(mov.importeTotal),
        emitidoPor: actorId,
      })
      .returning({ id: facturas.id });
  });

  await registrarAuditoria({
    actorId,
    accion: "crear",
    entidad: "factura",
    entidadId: row.id,
    datos: { movimientoId, tipoComprobante: c.tipoComprobante, numero: resultado.numero, cae: resultado.cae, puntoVenta },
  });

  const envio = await enviarFacturaPorMail(row.id);

  revalidatePath("/movimientos");
  revalidatePath(`/movimientos/${movimientoId}`);
  revalidatePath("/");

  return {
    ok: true,
    id: row.id,
    cae: resultado.cae!,
    numero: resultado.numero!,
    tipoComprobante: c.tipoComprobante,
    enviada: envio.ok,
    envioError: envio.ok ? undefined : envio.error,
  };
}

/** Reintenta el envío por mail de un comprobante ya emitido (no pide CAE de nuevo). */
export async function reenviarFactura(
  facturaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["admin", "ventas"]);
  const res = await enviarFacturaPorMail(facturaId);
  revalidatePath("/movimientos");
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "No se pudo enviar." };
}

/**
 * Versión "no explota" de `facturarMovimientoComo`, para llamar con
 * `after()` tras crear una venta sin sesión (ej. pedido de Tiendanube). Si
 * algo falla (AFIP, mail, datos del cliente) no rompe nada — la venta ya
 * quedó cargada; el movimiento sigue apareciendo en Movimientos con el
 * botón "Facturar" para resolverlo a mano.
 */
export async function facturarYEnviarSeguro(movimientoId: string): Promise<void> {
  try {
    const res = await facturarMovimientoComo(movimientoId, null);
    if (!res.ok) {
      console.error("auto-facturar (after):", res.error);
    } else if (!res.enviada) {
      console.error("auto-facturar: factura emitida pero no se pudo enviar:", res.envioError);
    }
  } catch (e) {
    console.error("auto-facturar (after):", e);
  }
}

/* ───────────────────────── Notas de crédito (adenda v1.3 §3) ───────────────────────── */

export type InputNotaCredito = {
  modalidad: "total" | "parcial";
  /** Requerido si modalidad === "parcial". Tope: saldo de la factura. */
  importe?: number;
  motivo: string;
  /** Solo aplica a "total": si hay devolución física, vuelve el stock. */
  devolucionFisica: boolean;
};

export type PrevisualizacionNc = {
  facturaId: string;
  tipoComprobante: string;
  saldo: number;
  importe: number;
  importeNeto: number;
  importeIva: number;
};

/** Qué se va a emitir si se confirma la NC — para la confirmación de §9.1. */
export async function previsualizarNotaCredito(
  movimientoId: string,
  input: Pick<InputNotaCredito, "modalidad" | "importe">,
): Promise<PrevisualizacionNc | { error: string }> {
  await requireRole(["admin", "ventas"]);
  const factura = await facturaDeMovimiento(movimientoId);
  if (!factura) return { error: "Este movimiento no tiene factura emitida." };

  const saldo = await saldoFactura(factura.id);
  if (saldo <= 0) return { error: "Esta factura ya está totalmente notada." };

  const importe = input.modalidad === "total" ? saldo : round2(input.importe ?? 0);
  if (importe <= 0) return { error: "El importe tiene que ser mayor a 0." };
  if (importe > saldo + 0.01) {
    return { error: `El importe no puede superar el saldo de la factura ($${saldo.toFixed(2)}).` };
  }

  const importeNeto = round2(importe / 1.21);
  const importeIva = round2(importe - importeNeto);

  return {
    facturaId: factura.id,
    tipoComprobante: factura.tipoComprobante === "A" ? "NCA" : "NCB",
    saldo,
    importe,
    importeNeto,
    importeIva,
  };
}

/** Emite la nota de crédito (A o B) contra la factura del movimiento. */
export async function emitirNotaCredito(
  movimientoId: string,
  input: InputNotaCredito,
): Promise<ActionResult> {
  const user = await requireRole(
    input.modalidad === "parcial" ? ["admin"] : ["admin", "ventas"],
  );

  const factura = await facturaDeMovimiento(movimientoId);
  if (!factura) return { ok: false, error: "Este movimiento no tiene factura emitida." };
  if (!factura.cae) return { ok: false, error: "Esta factura no tiene CAE (es externa) — no se puede notar desde acá." };

  const saldo = await saldoFactura(factura.id);
  const importe = input.modalidad === "total" ? saldo : round2(input.importe ?? 0);
  if (importe <= 0) return { ok: false, error: "El importe tiene que ser mayor a 0." };
  if (importe > saldo + 0.01) {
    return { ok: false, error: `El importe no puede superar el saldo de la factura ($${saldo.toFixed(2)}).` };
  }
  if (!input.motivo.trim()) return { ok: false, error: "Indicá el motivo de la nota de crédito." };

  const movRow = await db.query.movimientos.findFirst({ where: eq(movimientos.id, movimientoId) });
  if (!movRow) return { ok: false, error: "No encontré el movimiento." };

  const facturaFull = await db.query.facturas.findFirst({ where: eq(facturas.id, factura.id) });
  if (!facturaFull) return { ok: false, error: "No encontré la factura." };

  const snapshot = movRow.clienteSnapshot ? safeParse(movRow.clienteSnapshot) : null;
  const condicionIvaReceptorId = mapConditionIva((snapshot?.condicionIva as string) ?? null);
  const tipoComprobante = facturaFull.tipoComprobante === "A" ? "NCA" : "NCB";
  const cbteTipo = facturaFull.tipoComprobante === "A" ? CBTE_TIPO.ncA : CBTE_TIPO.ncB;

  const importeNeto = round2(importe / 1.21);
  const importeIva = round2(importe - importeNeto);

  const puntoVenta = Number(process.env.AFIP_PUNTO_VENTA ?? "0");
  if (!puntoVenta) return { ok: false, error: "Falta configurar AFIP_PUNTO_VENTA." };

  let numero: number;
  try {
    numero = (await feCompUltimoAutorizado(puntoVenta, cbteTipo)) + 1;
  } catch (e) {
    return { ok: false, error: `No se pudo consultar el último comprobante en AFIP: ${msg(e)}` };
  }

  const resultado = await feCaeSolicitar(
    puntoVenta,
    cbteTipo,
    numero,
    new Date().toISOString().slice(0, 10),
    {
      docTipo: facturaFull.docTipo,
      docNro: facturaFull.docNro,
      condicionIvaReceptorId,
      importeNeto,
      importeIva,
      importeTotal: importe,
      cbteAsoc: { tipo: facturaFull.codigoComprobante, ptoVta: facturaFull.puntoVenta, nro: facturaFull.numero },
    },
  ).catch((e) => ({ ok: false as const, motivo: msg(e) }));

  if (!resultado.ok) {
    return { ok: false, error: resultado.motivo ?? "AFIP rechazó la nota de crédito." };
  }

  // Devolución física (solo NC total): vuelve el stock a los lotes de origen,
  // o reversa la consignación si el movimiento no tocaba depósito.
  let costoDevuelto = 0;
  const esTotal = input.modalidad === "total";
  const esConsignacion = movRow.tipo === "venta_consignacion";

  const [row] = await db.transaction(async (tx) => {
    if (esTotal && input.devolucionFisica) {
      const items = await tx
        .select({ id: movimientoItems.id, productoId: movimientoItems.productoId, costo: movimientoItems.costo, consignacionId: movimientoItems.consignacionId })
        .from(movimientoItems)
        .where(eq(movimientoItems.movimientoId, movimientoId));

      for (const it of items) {
        costoDevuelto += Number(it.costo);
        if (esConsignacion && it.consignacionId) {
          const lotes = await tx
            .select({ loteId: movimientoItemLotes.loteId, cantidad: movimientoItemLotes.cantidad })
            .from(movimientoItemLotes)
            .where(eq(movimientoItemLotes.itemId, it.id));
          const total = lotes.reduce((a, l) => a + l.cantidad, 0);
          await tx
            .update(consignaciones)
            .set({ vendidas: sql`${consignaciones.vendidas} - ${total}` })
            .where(eq(consignaciones.id, it.consignacionId));
        } else {
          const lotes = await tx
            .select({ loteId: movimientoItemLotes.loteId, cantidad: movimientoItemLotes.cantidad })
            .from(movimientoItemLotes)
            .where(eq(movimientoItemLotes.itemId, it.id));
          for (const l of lotes) {
            await tx
              .update(stockLotes)
              .set({ unidadesEnDeposito: sql`${stockLotes.unidadesEnDeposito} + ${l.cantidad}` })
              .where(and(eq(stockLotes.productoId, it.productoId), eq(stockLotes.loteId, l.loteId)));
          }
        }
      }
    }

    if (esTotal) {
      await tx.update(movimientos).set({ estado: "con_nc_total" }).where(eq(movimientos.id, movimientoId));
    }

    const [nc] = await tx
      .insert(facturas)
      .values({
        movimientoId,
        puntoVenta,
        tipoComprobante,
        codigoComprobante: cbteTipo,
        numero: resultado.numero!,
        cae: resultado.cae!,
        caeVencimiento: resultado.caeVencimiento!,
        docTipo: facturaFull.docTipo,
        docNro: facturaFull.docNro,
        importeNeto: String(importeNeto),
        importeIva: String(importeIva),
        importeTotal: String(importe),
        comprobanteAsociadoId: facturaFull.id,
        motivo: input.motivo.trim(),
        emitidoPor: user.id,
      })
      .returning({ id: facturas.id });

    await generarAsientoNotaCredito(tx, {
      movimientoId,
      fecha: new Date().toISOString().slice(0, 10),
      importeNeto,
      importeIva,
      importeTotal: importe,
      medioPago: movRow.medioPago,
      esConsignacion,
      costoDevuelto: round2(costoDevuelto),
      creadorId: user.id,
      descripcion: `${tipoComprobante} ${movimientoId.slice(0, 8)} · ${input.motivo.trim()}`,
    });

    return [nc];
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "factura",
    entidadId: row.id,
    datos: { movimientoId, tipoComprobante, numero: resultado.numero, cae: resultado.cae, importe, motivo: input.motivo },
  });

  const envio = await enviarFacturaPorMail(row.id);

  revalidatePath("/movimientos");
  revalidatePath(`/movimientos/${movimientoId}`);
  revalidatePath("/finanzas");
  revalidatePath("/");

  return {
    ok: true,
    id: row.id,
    cae: resultado.cae!,
    numero: resultado.numero!,
    tipoComprobante,
    enviada: envio.ok,
    envioError: envio.ok ? undefined : envio.error,
  };
}

/* ───────────────────────── Facturas externas (adenda v1.3 §9.9) ───────────────────────── */

export type InputFacturaExterna = {
  tipoComprobante: "A" | "B";
  puntoVenta: number;
  numero: number;
};

/** Registra como ya facturada (fuera del sistema) una venta previa a la integración. */
export async function marcarFacturaExterna(
  movimientoId: string,
  input: InputFacturaExterna,
): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const mov = await movimientoParaFacturar(movimientoId);
  if (!mov) return { ok: false, error: "Este movimiento no es una venta facturable." };

  const yaFacturado = await facturaDeMovimiento(movimientoId);
  if (yaFacturado) return { ok: false, error: "Este movimiento ya tiene un comprobante." };

  const c = calcularComprobante(mov);

  const [row] = await db
    .insert(facturas)
    .values({
      movimientoId,
      puntoVenta: input.puntoVenta,
      tipoComprobante: input.tipoComprobante,
      codigoComprobante: input.tipoComprobante === "A" ? CBTE_TIPO.facturaA : CBTE_TIPO.facturaB,
      numero: input.numero,
      docTipo: c.docTipo,
      docNro: c.docNro,
      importeNeto: String(mov.importeNeto),
      importeIva: String(mov.importeIva),
      importeTotal: String(mov.importeTotal),
      origen: "externa",
      emitidoPor: user.id,
    })
    .returning({ id: facturas.id });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "factura",
    entidadId: row.id,
    datos: { movimientoId, tipoComprobante: input.tipoComprobante, numero: input.numero, origen: "externa" },
  });

  revalidatePath("/movimientos");

  return { ok: true, id: row.id, cae: "", numero: input.numero, tipoComprobante: input.tipoComprobante, enviada: false };
}

function mapConditionIva(c: string | null): number {
  switch (c) {
    case "responsable_inscripto":
      return 1;
    case "exento":
      return 4;
    case "monotributo":
      return 6;
    default:
      return 5; // Consumidor Final
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Fallo desconocido.";
}
