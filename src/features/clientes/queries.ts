import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { clientes, movimientos } from "@/db/schema";

export type ClienteListItem = {
  id: string;
  nombre: string;
  tipo: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
};

/** Lista de clientes. */
export async function listClientes(): Promise<ClienteListItem[]> {
  const rows = await db.query.clientes.findMany({
    orderBy: (c) => [asc(c.nombre)],
    columns: {
      id: true,
      nombre: true,
      tipo: true,
      email: true,
      telefono: true,
      activo: true,
    },
  });

  return rows;
}

export type Cliente = NonNullable<Awaited<ReturnType<typeof getCliente>>>;

export async function getCliente(id: string) {
  return db.query.clientes.findFirst({
    where: eq(clientes.id, id),
  });
}

/** Nombre ya usado por otro cliente (validación de unicidad, case-insensitive). */
export async function nombreEnUso(
  nombre: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(
      and(
        sql`lower(${clientes.nombre}) = lower(${nombre})`,
        exceptId ? sql`${clientes.id} != ${exceptId}` : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Cuenta cuántos movimientos usa a este cliente. */
export async function contarMovimientosDeCliente(
  clienteId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(movimientos)
    .where(eq(movimientos.clienteId, clienteId));
  return row?.n ?? 0;
}
