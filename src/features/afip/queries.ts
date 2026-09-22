import "server-only";

import { eq, sql } from "drizzle-orm";

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

export type MovimientoParaFacturar = {
  movimientoId: string;
  fecha: string;
  tipo: string;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteCuit: string | null;
  clienteCondicionIva: CondicionIva | null;
  importeNeto: number;
  importeIva: number;
  importeTotal: number;
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

  const [tot] = await db
    .select({ neto: sql<number>`coalesce(sum(${movimientoItems.ingresoNeto}), 0)` })
    .from(movimientoItems)
    .where(eq(movimientoItems.movimientoId, movimientoId));

  const importeNeto = round2(Number(tot?.neto ?? 0));
  const importeIva = round2(importeNeto * (IVA - 1));
  const importeTotal = round2(importeNeto + importeIva);

  return {
    movimientoId,
    fecha: mov.fecha,
    tipo: mov.tipo,
    clienteId: mov.clienteId,
    clienteNombre: cliente?.nombre ?? null,
    clienteCuit: cliente?.cuit ?? null,
    clienteCondicionIva: (cliente?.condicionIva as CondicionIva) ?? null,
    importeNeto,
    importeIva,
    importeTotal,
  };
}

export type FacturaRow = {
  id: string;
  puntoVenta: number;
  tipoComprobante: string;
  numero: number;
  cae: string;
  caeVencimiento: string;
  importeTotal: string;
  createdAt: Date;
};

export async function facturaDeMovimiento(
  movimientoId: string,
): Promise<FacturaRow | null> {
  const row = await db.query.facturas.findFirst({
    where: eq(facturas.movimientoId, movimientoId),
  });
  return row ?? null;
}

export type FacturaCompleta = {
  id: string;
  puntoVenta: number;
  tipoComprobante: string;
  codigoComprobante: number;
  numero: number;
  cae: string;
  caeVencimiento: string;
  docTipo: number;
  docNro: string;
  importeNeto: number;
  importeIva: number;
  importeTotal: number;
  fecha: string;
  clienteNombre: string | null;
  clienteCondicionIva: CondicionIva | null;
  items: { producto: string; sku: string; cantidad: number; precioNeto: number }[];
};

/** Todo lo necesario para armar el PDF de una factura ya emitida. */
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

  return {
    id: f.id,
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
    fecha: mov?.fecha ?? f.createdAt.toISOString().slice(0, 10),
    clienteNombre: cliente?.nombre ?? null,
    clienteCondicionIva: (cliente?.condicionIva as CondicionIva) ?? null,
    items: items.map((it) => ({
      producto: it.producto,
      sku: it.sku,
      cantidad: it.cantidad,
      precioNeto: Number(it.precioNeto),
    })),
  };
}
