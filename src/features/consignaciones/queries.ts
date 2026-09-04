import "server-only";

import { db } from "@/db";

import { estadoConsig, type ConsignacionRow } from "./schema";

export async function listConsignaciones(): Promise<ConsignacionRow[]> {
  const rows = await db.query.consignaciones.findMany({
    with: {
      cliente: { columns: { nombre: true } },
      producto: { columns: { nombre: true, ppp: true } },
      lote: { columns: { nombre: true } },
    },
    orderBy: (c, { desc }) => [desc(c.fecha)],
  });

  return rows.map((c) => {
    const pendientes = c.entregadas - c.vendidas - c.devueltas;
    return {
      id: c.id,
      clienteId: c.clienteId,
      cliente: c.cliente.nombre,
      productoId: c.productoId,
      producto: c.producto.nombre,
      lote: c.lote.nombre,
      fecha: c.fecha,
      vence: c.vence,
      entregadas: c.entregadas,
      vendidas: c.vendidas,
      devueltas: c.devueltas,
      pendientes,
      estado: estadoConsig(pendientes, c.vendidas, c.devueltas, c.vence),
      ppp: Number(c.producto.ppp),
    };
  });
}

export function indicadoresConsig(rows: ConsignacionRow[]) {
  const abiertas = rows.filter((r) => r.pendientes > 0);
  return {
    abiertas: abiertas.length,
    unidadesAfuera: abiertas.reduce((a, r) => a + r.pendientes, 0),
    valorAfuera: abiertas.reduce((a, r) => a + r.pendientes * r.ppp, 0),
    vencidas: rows.filter((r) => r.estado === "vencida").length,
  };
}
