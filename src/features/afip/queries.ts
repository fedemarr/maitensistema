import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  facturas,
  movimientoItems,
  movimientos,
  productos,
} from "@/db/schema";
import type { CondicionIva } from "@/features/clientes/schema";
import { round2 } from "@/lib/stock";

const IVA = 1.21;
const TIPOS_ORIGINALES = ["A", "B"] as const;

export type MovimientoParaFacturar = {
  movimientoId: string;
  fecha: string;
  tipo: string;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteCuit: string | null;
  clienteEmail: string | null;
  clienteCondicionIva: CondicionIva | null;
  importeNeto: number;
  importeIva: number;
  importeTotal: number;
  items: { productoId: string; producto: string; cantidad: number; precioNeto: number }[];
};

/** Datos de un movimiento de venta para facturar (o null si no es venta). */
export async function movimientoParaFacturar(
  movimientoId: string,
): Promise<MovimientoParaFacturar | null> {
  const mov = await db.query.movimientos.findFirst({
    where: eq(movimientos.id, movimientoId),
  });
  if (!mov || (mov.tipo !== "venta" && mov.tipo !== "venta_consignacion")) return null;

  const cliente = mov.clienteId
    ? await db.query.clientes.findFirst({ where: eq(clientes.id, mov.clienteId) })
    : null;

  const items = await db
    .select({
      productoId: movimientoItems.productoId,
      producto: productos.nombre,
      cantidad: movimientoItems.cantidad,
      precioNeto: movimientoItems.precioNeto,
    })
    .from(movimientoItems)
    .innerJoin(productos, eq(movimientoItems.productoId, productos.id))
    .where(eq(movimientoItems.movimientoId, movimientoId));

  const importeNeto = round2(
    items.reduce((a, it) => a + it.cantidad * Number(it.precioNeto), 0),
  );
  const importeIva = round2(importeNeto * (IVA - 1));
  const importeTotal = round2(importeNeto + importeIva);

  return {
    movimientoId,
    fecha: mov.fecha,
    tipo: mov.tipo,
    clienteId: mov.clienteId,
    clienteNombre: cliente?.nombre ?? null,
    clienteCuit: cliente?.cuit ?? null,
    clienteEmail: cliente?.email ?? null,
    clienteCondicionIva: (cliente?.condicionIva as CondicionIva) ?? null,
    importeNeto,
    importeIva,
    importeTotal,
    items: items.map((it) => ({
      productoId: it.productoId,
      producto: it.producto,
      cantidad: it.cantidad,
      precioNeto: Number(it.precioNeto),
    })),
  };
}

export type FacturaRow = {
  id: string;
  puntoVenta: number;
  tipoComprobante: string;
  numero: number;
  cae: string | null;
  caeVencimiento: string | null;
  importeTotal: string;
  createdAt: Date;
};

/** La factura ORIGINAL (A o B, no una NC) de un movimiento, si tiene. */
export async function facturaDeMovimiento(
  movimientoId: string,
): Promise<FacturaRow | null> {
  const row = await db.query.facturas.findFirst({
    where: and(
      eq(facturas.movimientoId, movimientoId),
      inArray(facturas.tipoComprobante, TIPOS_ORIGINALES),
    ),
  });
  return row ?? null;
}

/** Todas las notas de crédito ya emitidas contra una factura. */
export async function notasCreditoDeFactura(facturaId: string) {
  return db.query.facturas.findMany({
    where: eq(facturas.comprobanteAsociadoId, facturaId),
    orderBy: (f, { asc }) => [asc(f.createdAt)],
  });
}

/** Importe que todavía se puede notar (total − NC ya emitidas). */
export async function saldoFactura(facturaId: string): Promise<number> {
  const factura = await db.query.facturas.findFirst({ where: eq(facturas.id, facturaId) });
  if (!factura) return 0;
  const ncs = await notasCreditoDeFactura(facturaId);
  const notado = ncs.reduce((a, nc) => a + Number(nc.importeTotal), 0);
  return round2(Number(factura.importeTotal) - notado);
}

export type FacturaCompleta = {
  id: string;
  movimientoId: string;
  puntoVenta: number;
  tipoComprobante: string;
  codigoComprobante: number;
  numero: number;
  cae: string | null;
  caeVencimiento: string | null;
  docTipo: number;
  docNro: string;
  importeNeto: number;
  importeIva: number;
  importeTotal: number;
  fecha: string;
  clienteNombre: string | null;
  clienteEmail: string | null;
  clienteCondicionIva: CondicionIva | null;
  motivo: string | null;
  /** Si es una NC, el comprobante que corrige. */
  asociado: { tipoComprobante: string; puntoVenta: number; numero: number } | null;
  items: { producto: string; sku: string; cantidad: number; precioNeto: number }[];
};

/** Todo lo necesario para armar el PDF de un comprobante (factura o NC) ya emitido. */
export async function facturaCompleta(
  facturaId: string,
): Promise<FacturaCompleta | null> {
  const f = await db.query.facturas.findFirst({ where: eq(facturas.id, facturaId) });
  if (!f) return null;

  const mov = await db.query.movimientos.findFirst({
    where: eq(movimientos.id, f.movimientoId),
  });
  const cliente = mov?.clienteId
    ? await db.query.clientes.findFirst({ where: eq(clientes.id, mov.clienteId) })
    : null;

  const asociado = f.comprobanteAsociadoId
    ? await db.query.facturas.findFirst({
        where: eq(facturas.id, f.comprobanteAsociadoId),
        columns: { tipoComprobante: true, puntoVenta: true, numero: true },
      })
    : null;

  // Para una NC parcial, los ítems mostrados son del movimiento original
  // (referencia); el importe de la NC puede no coincidir con la suma.
  const items = await db
    .select({
      producto: productos.nombre,
      sku: productos.sku,
      cantidad: movimientoItems.cantidad,
      precioNeto: movimientoItems.precioNeto,
    })
    .from(movimientoItems)
    .innerJoin(productos, eq(movimientoItems.productoId, productos.id))
    .where(eq(movimientoItems.movimientoId, f.movimientoId));

  const snapshot = mov?.clienteSnapshot ? safeParse(mov.clienteSnapshot) : null;

  return {
    id: f.id,
    movimientoId: f.movimientoId,
    puntoVenta: f.puntoVenta,
    tipoComprobante: f.tipoComprobante,
    codigoComprobante: f.codigoComprobante,
    numero: f.numero,
    cae: f.cae,
    caeVencimiento: f.caeVencimiento,
    docTipo: f.docTipo,
    docNro: f.docNro,
    importeNeto: Number(f.importeNeto),
    importeIva: Number(f.importeIva),
    importeTotal: Number(f.importeTotal),
    fecha: f.createdAt.toISOString().slice(0, 10),
    clienteNombre: (snapshot?.nombre as string | undefined) ?? cliente?.nombre ?? null,
    clienteEmail: cliente?.email ?? null,
    clienteCondicionIva:
      (snapshot?.condicionIva as CondicionIva | undefined) ??
      (cliente?.condicionIva as CondicionIva) ??
      null,
    motivo: f.motivo,
    asociado: asociado
      ? { tipoComprobante: asociado.tipoComprobante, puntoVenta: asociado.puntoVenta, numero: asociado.numero }
      : null,
    items: items.map((it) => ({
      producto: it.producto,
      sku: it.sku,
      cantidad: it.cantidad,
      precioNeto: Number(it.precioNeto),
    })),
  };
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/** Resumen para Inicio: facturas emitidas que todavía no se pudieron enviar. */
export async function facturasPendientesEnvio(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(facturas)
    .where(and(eq(facturas.enviada, false), sql`${facturas.origen} = 'sistema'`));
  return row?.n ?? 0;
}
