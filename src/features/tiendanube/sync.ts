import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { integraciones, productos, stockLotes } from "@/db/schema";
import { getProductos, setVariantStock } from "./api";
import { credencialesTN, PROVEEDOR } from "./queries";

/** Empuja el stock en depósito de los productos `online` hacia Tiendanube. */
export async function sincronizarStock(): Promise<{
  actualizados: number;
  sinMatch: number;
  errores: number;
}> {
  const cred = await credencialesTN();
  if (!cred) throw new Error("Integración no conectada.");

  // Stock en depósito por producto terminado online.
  const locales = await db
    .select({
      id: productos.id,
      sku: productos.sku,
      deposito: sql<number>`coalesce(sum(${stockLotes.unidadesEnDeposito}), 0)`,
    })
    .from(productos)
    .leftJoin(stockLotes, eq(stockLotes.productoId, productos.id))
    .where(sql`${productos.esInsumo} = false and ${productos.online} = true`)
    .groupBy(productos.id, productos.sku);
  const stockPorSku = new Map(
    locales.map((l) => [l.sku.toLowerCase(), Number(l.deposito)]),
  );

  const tnProducts = await getProductos(cred.storeId, cred.token);

  let actualizados = 0;
  let sinMatch = 0;
  let errores = 0;
  const detalleErrores: string[] = [];

  for (const p of tnProducts) {
    for (const v of p.variants) {
      const sku = v.sku?.toLowerCase();
      if (!sku || !stockPorSku.has(sku)) {
        if (sku) sinMatch++;
        continue;
      }
      const objetivo = stockPorSku.get(sku)!;
      if (v.stock === objetivo) continue;
      try {
        await setVariantStock(cred.storeId, cred.token, p.id, v.id, objetivo);
        actualizados++;
      } catch (e) {
        errores++;
        detalleErrores.push(
          `${sku}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  const row = await db.query.integraciones.findFirst({
    where: eq(integraciones.proveedor, PROVEEDOR),
  });
  const datos = row?.datos ? safeParse(row.datos) : {};
  datos.ultimoSyncResumen = { actualizados, sinMatch, errores, detalleErrores };
  await db
    .update(integraciones)
    .set({ ultimoSync: new Date(), datos: JSON.stringify(datos) })
    .where(eq(integraciones.proveedor, PROVEEDOR));

  return { actualizados, sinMatch, errores };
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
