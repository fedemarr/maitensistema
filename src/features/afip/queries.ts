import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { clientes, facturas, movimientoItems, movimientos } from "@/db/schema";
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
