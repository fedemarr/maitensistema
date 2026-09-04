import "server-only";

import { asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { preciosVenta, productos } from "@/db/schema";
import type { TipoLista } from "./schema";

export type PrecioVigente = { precioConIva: string; vigenteDesde: string } | null;

export type ProductoConPrecios = {
  productoId: string;
  nombre: string;
  sku: string;
  retail: PrecioVigente;
  mayorista: PrecioVigente;
};

/** Precio vigente (retail y mayorista) de cada producto terminado. */
export async function preciosVigentes(): Promise<ProductoConPrecios[]> {
  const [terminados, vigentes] = await Promise.all([
    db
      .select({ id: productos.id, nombre: productos.nombre, sku: productos.sku })
      .from(productos)
      .where(eq(productos.esInsumo, false))
      .orderBy(asc(productos.nombre)),
    db
      .select()
      .from(preciosVenta)
      .where(isNull(preciosVenta.vigenteHasta)),
  ]);

  const porProducto = new Map<
    string,
    { retail?: PrecioVigente; mayorista?: PrecioVigente }
  >();
  for (const v of vigentes) {
    const entry = porProducto.get(v.productoId) ?? {};
    entry[v.tipoLista as TipoLista] = {
      precioConIva: v.precioConIva,
      vigenteDesde: v.vigenteDesde,
    };
    porProducto.set(v.productoId, entry);
  }

  return terminados.map((p) => ({
    productoId: p.id,
    nombre: p.nombre,
    sku: p.sku,
    retail: porProducto.get(p.id)?.retail ?? null,
    mayorista: porProducto.get(p.id)?.mayorista ?? null,
  }));
}

export type PrecioHistorial = {
  id: string;
  tipoLista: TipoLista;
  precioConIva: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
};

export async function historialPrecios(
  productoId: string,
): Promise<PrecioHistorial[]> {
  const rows = await db
    .select()
    .from(preciosVenta)
    .where(eq(preciosVenta.productoId, productoId))
    .orderBy(desc(preciosVenta.vigenteDesde));
  return rows.map((r) => ({
    id: r.id,
    tipoLista: r.tipoLista as TipoLista,
    precioConIva: r.precioConIva,
    vigenteDesde: r.vigenteDesde,
    vigenteHasta: r.vigenteHasta,
  }));
}
