"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { facturas } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { facturaDeMovimiento, movimientoParaFacturar } from "./queries";
import { enviarFacturaPorMail } from "./lib/mailer";
import { CBTE_TIPO, feCaeSolicitar, feCompUltimoAutorizado, feDummy } from "./lib/wsfe";

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

  const yaFacturado = await facturaDeMovimiento(movimientoId);
  if (yaFacturado) {
    return {
      ok: false,
      error: `Ya está facturado: ${yaFacturado.tipoComprobante} N.º ${yaFacturado.numero} (CAE ${yaFacturado.cae}).`,
    };
  }

  const esRI = mov.clienteCondicionIva === "responsable_inscripto";
  if (esRI && !mov.clienteCuit) {
    return {
      ok: false,
      error: "El cliente es Responsable Inscripto pero no tiene CUIT cargado.",
    };
  }

  // El campo "CUIT" del cliente también admite DNI: 11 dígitos = CUIT (80),
  // 7-8 = DNI (96), cualquier otra cosa = consumidor final sin identificar (99).
  const digitos = (mov.clienteCuit ?? "").replace(/\D/g, "");
  const docTipo = digitos.length === 11 ? 80 : digitos.length >= 7 && digitos.length <= 8 ? 96 : 99;
  const docNro = docTipo === 99 ? "0" : digitos;
  if (esRI && docTipo !== 80) {
    return { ok: false, error: "Para Factura A el cliente necesita un CUIT válido (11 dígitos)." };
  }
  const condicionIvaReceptorId = mapConditionIva(mov.clienteCondicionIva);
  const tipoComprobante = esRI ? "A" : "B";
  const cbteTipo = esRI ? CBTE_TIPO.facturaA : CBTE_TIPO.facturaB;

  const puntoVenta = Number(process.env.AFIP_PUNTO_VENTA ?? "0");
  if (!puntoVenta) return { ok: false, error: "Falta configurar AFIP_PUNTO_VENTA." };

  let numero: number;
  try {
    numero = (await feCompUltimoAutorizado(puntoVenta, cbteTipo)) + 1;
  } catch (e) {
    return {
      ok: false,
      error: `No se pudo consultar el último comprobante en AFIP: ${msg(e)}`,
    };
  }

  const resultado = await feCaeSolicitar(
    puntoVenta,
    cbteTipo,
    numero,
    new Date().toISOString().slice(0, 10),
    {
      docTipo,
      docNro,
      condicionIvaReceptorId,
      importeNeto: mov.importeNeto,
      importeIva: mov.importeIva,
      importeTotal: mov.importeTotal,
    },
  ).catch((e) => ({ ok: false as const, motivo: msg(e) }));

  if (!resultado.ok) {
    return { ok: false, error: resultado.motivo ?? "AFIP rechazó el comprobante." };
  }

  const [row] = await db
    .insert(facturas)
    .values({
      movimientoId,
      puntoVenta,
      tipoComprobante,
      codigoComprobante: cbteTipo,
      numero: resultado.numero!,
      cae: resultado.cae!,
      caeVencimiento: resultado.caeVencimiento!,
      docTipo,
      docNro,
      importeNeto: String(mov.importeNeto),
      importeIva: String(mov.importeIva),
      importeTotal: String(mov.importeTotal),
      emitidoPor: actorId,
    })
    .returning({ id: facturas.id });

  await registrarAuditoria({
    actorId,
    accion: "crear",
    entidad: "factura",
    entidadId: row.id,
    datos: {
      movimientoId,
      tipoComprobante,
      numero: resultado.numero,
      cae: resultado.cae,
      puntoVenta,
    },
  });

  const envio = await enviarFacturaPorMail(row.id);

  revalidatePath("/movimientos");

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

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Fallo desconocido.";
}
