import "server-only";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  consignaciones,
  facturas,
  lotes,
  movimientoItemLotes,
  movimientoItems,
  movimientos,
  productos,
  stockLotes,
  auditoria,
} from "@/db/schema";
import type { TipoManual } from "./schema";

const TIPOS_ORIGINALES = ["A", "B"] as const;

export type MovimientoRow = {
  movimientoId: string;
  itemId: string;
  fecha: string;
  tipo: TipoManual | "produccion";
  estado: string;
  producto: string;
  cliente: string | null;
  clienteId: string | null;
  medioPago: string | null;
  lotes: string;
  cantidad: number;
  ingresoNeto: string;
  costo: string;
  facturaId: string | null;
  facturaTipo: string | null;
  facturaNumero: number | null;
  facturaPuntoVenta: number | null;
  facturaEnviada: boolean | null;
  facturaEnviadoA: string | null;
  facturaEnviadaEn: Date | null;
  facturaEnvioError: string | null;
};

export type FiltrosMovimientos = {
  tipo?: string;
  productoId?: string;
  desde?: string;
  hasta?: string;
  /** Tope de filas para no traer todo el historial (default 500). */
  limite?: number;
};

/** Historial: una fila por ítem de movimiento, recientes primero. */
export async function listMovimientos(
  f: FiltrosMovimientos = {},
): Promise<MovimientoRow[]> {
  const limite = f.limite ?? 500;
  const cond = [];
  if (f.tipo) cond.push(eq(movimientos.tipo, f.tipo as TipoManual));
  if (f.productoId) cond.push(eq(movimientoItems.productoId, f.productoId));
  if (f.desde) cond.push(gte(movimientos.fecha, f.desde));
  if (f.hasta) cond.push(lte(movimientos.fecha, f.hasta));

  const rows = await db
    .select({
      movimientoId: movimientos.id,
      itemId: movimientoItems.id,
      fecha: movimientos.fecha,
      tipo: movimientos.tipo,
      estado: movimientos.estado,
      producto: productos.nombre,
      cliente: clientes.nombre,
      clienteId: movimientos.clienteId,
      medioPago: movimientos.medioPago,
      cantidad: movimientoItems.cantidad,
      ingresoNeto: movimientoItems.ingresoNeto,
      costo: movimientoItems.costo,
      createdAt: movimientos.createdAt,
      facturaId: facturas.id,
      facturaTipo: facturas.tipoComprobante,
      facturaNumero: facturas.numero,
      facturaPuntoVenta: facturas.puntoVenta,
      facturaEnviada: facturas.enviada,
      facturaEnviadoA: facturas.enviadoA,
      facturaEnviadaEn: facturas.enviadaEn,
      facturaEnvioError: facturas.envioError,
    })
    .from(movimientoItems)
    .innerJoin(movimientos, eq(movimientoItems.movimientoId, movimientos.id))
    .innerJoin(productos, eq(movimientoItems.productoId, productos.id))
    .leftJoin(clientes, eq(movimientos.clienteId, clientes.id))
    .leftJoin(
      facturas,
      and(eq(facturas.movimientoId, movimientos.id), inArray(facturas.tipoComprobante, TIPOS_ORIGINALES)),
    )
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(desc(movimientos.fecha), desc(movimientos.createdAt))
    .limit(limite);

  const itemIds = rows.map((r) => r.itemId);
  const lotesByItem = new Map<string, string[]>();
  if (itemIds.length) {
    const mils = await db
      .select({
        itemId: movimientoItemLotes.itemId,
        nombre: lotes.nombre,
        cantidad: movimientoItemLotes.cantidad,
      })
      .from(movimientoItemLotes)
      .innerJoin(lotes, eq(movimientoItemLotes.loteId, lotes.id))
      .where(inArray(movimientoItemLotes.itemId, itemIds));
    for (const m of mils) {
      if (!lotesByItem.has(m.itemId)) lotesByItem.set(m.itemId, []);
      lotesByItem
        .get(m.itemId)!
        .push(`${m.nombre.replace("Lote N.º ", "L")} ×${m.cantidad}`);
    }
  }

  return rows.map((r) => ({
    movimientoId: r.movimientoId,
    itemId: r.itemId,
    fecha: r.fecha,
    tipo: r.tipo,
    estado: r.estado,
    producto: r.producto,
    cliente: r.cliente,
    clienteId: r.clienteId,
    medioPago: r.medioPago,
    lotes: (lotesByItem.get(r.itemId) ?? []).join(" · ") || "—",
    cantidad: r.cantidad,
    ingresoNeto: r.ingresoNeto,
    costo: r.costo,
    facturaId: r.facturaId,
    facturaTipo: r.facturaTipo,
    facturaNumero: r.facturaNumero,
    facturaPuntoVenta: r.facturaPuntoVenta,
    facturaEnviada: r.facturaEnviada,
    facturaEnviadoA: r.facturaEnviadoA,
    facturaEnviadaEn: r.facturaEnviadaEn,
    facturaEnvioError: r.facturaEnvioError,
  }));
}

/** Cuántas facturas (origen sistema) quedaron sin enviar — para el aviso de Inicio. */
export async function contarFacturasSinEnviar(): Promise<number> {
  const rows = await db
    .select({ id: facturas.id })
    .from(facturas)
    .where(
      and(
        eq(facturas.enviada, false),
        eq(facturas.origen, "sistema"),
        inArray(facturas.tipoComprobante, TIPOS_ORIGINALES),
      ),
    );
  return rows.length;
}

export type MovimientoDetalleItem = {
  id: string;
  productoId: string;
  producto: string;
  cantidad: number;
  precioNeto: string | null;
  costo: string;
  ingresoNeto: string;
  lotes: { loteId: string; loteNombre: string; cantidad: number }[];
};

export type MovimientoDetalle = {
  id: string;
  fecha: string;
  tipo: TipoManual | "produccion";
  estado: string;
  origen: string;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteSnapshot: { nombre?: string; doc?: string; condicionIva?: string } | null;
  medioPago: string | null;
  observaciones: string | null;
  items: MovimientoDetalleItem[];
  factura: {
    id: string;
    tipoComprobante: string;
    puntoVenta: number;
    numero: number;
    cae: string | null;
  } | null;
  notasCredito: {
    id: string;
    tipoComprobante: string;
    puntoVenta: number;
    numero: number;
    importeTotal: string;
    motivo: string | null;
    createdAt: Date;
  }[];
};

/** Todo lo necesario para ver/editar un movimiento. */
export async function movimientoDetalle(id: string): Promise<MovimientoDetalle | null> {
  const mov = await db.query.movimientos.findFirst({ where: eq(movimientos.id, id) });
  if (!mov) return null;

  const cliente = mov.clienteId
    ? await db.query.clientes.findFirst({ where: eq(clientes.id, mov.clienteId) })
    : null;

  const itemsRows = await db
    .select({
      id: movimientoItems.id,
      productoId: movimientoItems.productoId,
      producto: productos.nombre,
      cantidad: movimientoItems.cantidad,
      precioNeto: movimientoItems.precioNeto,
      costo: movimientoItems.costo,
      ingresoNeto: movimientoItems.ingresoNeto,
    })
    .from(movimientoItems)
    .innerJoin(productos, eq(movimientoItems.productoId, productos.id))
    .where(eq(movimientoItems.movimientoId, id));

  const itemIds = itemsRows.map((i) => i.id);
  const lotesPorItem = new Map<string, { loteId: string; loteNombre: string; cantidad: number }[]>();
  if (itemIds.length) {
    const mils = await db
      .select({
        itemId: movimientoItemLotes.itemId,
        loteId: movimientoItemLotes.loteId,
        loteNombre: lotes.nombre,
        cantidad: movimientoItemLotes.cantidad,
      })
      .from(movimientoItemLotes)
      .innerJoin(lotes, eq(movimientoItemLotes.loteId, lotes.id))
      .where(inArray(movimientoItemLotes.itemId, itemIds));
    for (const m of mils) {
      if (!lotesPorItem.has(m.itemId)) lotesPorItem.set(m.itemId, []);
      lotesPorItem.get(m.itemId)!.push({ loteId: m.loteId, loteNombre: m.loteNombre, cantidad: m.cantidad });
    }
  }

  const todasFacturas = await db.query.facturas.findMany({
    where: eq(facturas.movimientoId, id),
    orderBy: (f, { asc }) => [asc(f.createdAt)],
  });
  const original = todasFacturas.find((f) => TIPOS_ORIGINALES.includes(f.tipoComprobante as "A" | "B"));
  const notas = todasFacturas.filter((f) => f.tipoComprobante.startsWith("NC"));

  return {
    id: mov.id,
    fecha: mov.fecha,
    tipo: mov.tipo,
    estado: mov.estado,
    origen: mov.origen,
    clienteId: mov.clienteId,
    clienteNombre: cliente?.nombre ?? null,
    clienteSnapshot: mov.clienteSnapshot ? safeParse(mov.clienteSnapshot) : null,
    medioPago: mov.medioPago,
    observaciones: mov.observaciones,
    items: itemsRows.map((i) => ({
      id: i.id,
      productoId: i.productoId,
      producto: i.producto,
      cantidad: i.cantidad,
      precioNeto: i.precioNeto,
      costo: i.costo,
      ingresoNeto: i.ingresoNeto,
      lotes: lotesPorItem.get(i.id) ?? [],
    })),
    factura: original
      ? { id: original.id, tipoComprobante: original.tipoComprobante, puntoVenta: original.puntoVenta, numero: original.numero, cae: original.cae }
      : null,
    notasCredito: notas.map((n) => ({
      id: n.id,
      tipoComprobante: n.tipoComprobante,
      puntoVenta: n.puntoVenta,
      numero: n.numero,
      importeTotal: n.importeTotal,
      motivo: n.motivo,
      createdAt: n.createdAt,
    })),
  };
}

export type CambioAuditoria = {
  id: string;
  actorId: string | null;
  accion: string;
  datos: Record<string, unknown> | null;
  createdAt: Date;
};

/** Historial de cambios de un movimiento (auditoría genérica, política B). */
export async function historialMovimiento(movimientoId: string): Promise<CambioAuditoria[]> {
  const rows = await db.query.auditoria.findMany({
    where: and(eq(auditoria.entidad, "movimiento"), eq(auditoria.entidadId, movimientoId)),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
  return rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    accion: r.accion,
    datos: r.datos ? safeParse(r.datos) : null,
    createdAt: r.createdAt,
  }));
}

/** Lotes con stock disponible de un producto (para reasignar lote, solo admin). */
export async function lotesConStock(productoId: string) {
  return db
    .select({ loteId: stockLotes.loteId, nombre: lotes.nombre, disponible: stockLotes.unidadesEnDeposito })
    .from(stockLotes)
    .innerJoin(lotes, eq(stockLotes.loteId, lotes.id))
    .where(and(eq(stockLotes.productoId, productoId), gte(stockLotes.unidadesEnDeposito, 1)))
    .orderBy(asc(lotes.fecha));
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/** Productos terminados activos para el selector de ítems. */
export async function listProductosVenta() {
  return db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      ppp: productos.ppp,
    })
    .from(productos)
    .where(and(eq(productos.esInsumo, false), eq(productos.activo, true)))
    .orderBy(asc(productos.nombre));
}

export async function listClientesActivos() {
  return db
    .select({ id: clientes.id, nombre: clientes.nombre, tipo: clientes.tipo })
    .from(clientes)
    .where(eq(clientes.activo, true))
    .orderBy(asc(clientes.nombre));
}

/** Consignaciones abiertas de un cliente para un producto (para venta/devolución). */
export async function consignacionesAbiertas(
  clienteId: string,
  productoId: string,
) {
  const rows = await db
    .select()
    .from(consignaciones)
    .where(
      and(
        eq(consignaciones.clienteId, clienteId),
        eq(consignaciones.productoId, productoId),
      ),
    )
    .orderBy(asc(consignaciones.fecha));
  return rows
    .map((c) => ({ ...c, pendientes: c.entregadas - c.vendidas - c.devueltas }))
    .filter((c) => c.pendientes > 0);
}
