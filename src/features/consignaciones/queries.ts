import "server-only";

import { desc } from "drizzle-orm";

import { db } from "@/db";

export async function listConsignaciones() {
  const hoy = new Date().toISOString().slice(0, 10);
  const rows = await db.query.consignaciones.findMany({
    orderBy: (c) => [desc(c.fecha)],
    with: {
      cliente: { columns: { id: true, nombre: true } },
      movimiento: {
        columns: { id: true, tipo: true, total: true },
        with: {
          items: {
            columns: { id: true, varianteId: true, cantidad: true, precioUnit: true },
            with: {
              variante: {
                columns: { nombre: true },
                with: { producto: { columns: { nombre: true } } },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((c) => ({
    ...c,
    vencida: c.estado === "pendiente" && c.venceEl < hoy,
  }));
}

export type ConsignacionListItem = Awaited<
  ReturnType<typeof listConsignaciones>
>[number];