import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { clientes, integraciones, movimientos, productos } from "@/db/schema";
import { crearMovimientoComo } from "@/features/movimientos/actions";
import { registrarAuditoria } from "@/lib/audit";
import { round2 } from "@/lib/stock";
import { getOrder } from "./api";
import { credencialesTN, PROVEEDOR } from "./queries";

const IVA = 1.21;
const CLIENTE_TN = "Consumidor final (Tienda Nube)";

/** Verifica el header `x-linkedstore-hmac-sha256` contra el cuerpo crudo. */
export function verificarFirma(rawBody: string, firma: string | null): boolean {
  const secret = process.env.TIENDANUBE_CLIENT_SECRET;
  if (!secret || !firma) return false;
  const esperado = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(esperado);
  const b = Buffer.from(firma);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Resultado =
  | { ok: true; estado: "creado" | "duplicado" | "sin_mapear" }
  | { ok: false; error: string };

/** Procesa un webhook de pedido: lo trae por API y lo carga como venta. */
export async function procesarPedido(orderId: number): Promise<Resultado> {
  const cred = await credencialesTN();
  if (!cred) return { ok: false, error: "Integración no conectada." };

  const externo = `tiendanube:${orderId}`;
  const yaExiste = await db.query.movimientos.findFirst({
    where: eq(movimientos.origenExterno, externo),
    columns: { id: true },
  });
  if (yaExiste) return { ok: true, estado: "duplicado" };

  const order = await getOrder(cred.storeId, cred.token, orderId);

  // Mapear líneas por SKU.
  const skus = order.products.map((p) => p.sku).filter(Boolean) as string[];
  const prods = skus.length
    ? await db
        .select({ id: productos.id, sku: productos.sku })
        .from(productos)
        .where(
          and(
            eq(productos.esInsumo, false),
            sql`lower(${productos.sku}) in (${sql.join(
              skus.map((s) => sql`${s.toLowerCase()}`),
              sql`, `,
            )})`,
          ),
        )
    : [];
  const idPorSku = new Map(prods.map((p) => [p.sku.toLowerCase(), p.id]));

  const items: { productoId: string; cantidad: number; precioNeto: number }[] = [];
  const sinMapear: string[] = [];
  for (const l of order.products) {
    const pid = l.sku ? idPorSku.get(l.sku.toLowerCase()) : undefined;
    if (!pid) {
      sinMapear.push(`${l.name}${l.sku ? ` (SKU ${l.sku})` : " (sin SKU)"}`);
      continue;
    }
    items.push({
      productoId: pid,
      cantidad: l.quantity,
      // Tiendanube guarda el precio con IVA; el sistema trabaja neto.
      precioNeto: round2(Number(l.price) / IVA),
    });
  }

  if (sinMapear.length) {
    await anotarSinMapear(order.number, sinMapear);
  }
  if (items.length === 0) {
    return { ok: true, estado: "sin_mapear" };
  }

  const clienteRow = await db.query.clientes.findFirst({
    where: sql`lower(${clientes.nombre}) = lower(${CLIENTE_TN})`,
    columns: { id: true },
  });

  const res = await crearMovimientoComo(
    {
      tipo: "venta",
      fecha: order.created_at.slice(0, 10),
      clienteId: clienteRow?.id ?? "",
      medioPago: "tienda_nube",
      loteId: "",
      observaciones: `Tiendanube #${order.number}${
        sinMapear.length ? ` · ${sinMapear.length} línea(s) sin mapear` : ""
      }`,
      items,
    },
    null,
    { origen: "tiendanube", origenExterno: externo },
  );

  if (!res.ok) return { ok: false, error: res.error };

  await registrarAuditoria({
    actorId: null,
    accion: "crear",
    entidad: "movimiento",
    entidadId: res.id,
    datos: { origen: "tiendanube", pedido: order.number, sinMapear },
  });

  return { ok: true, estado: "creado" };
}

async function anotarSinMapear(pedido: number, lineas: string[]) {
  const row = await db.query.integraciones.findFirst({
    where: eq(integraciones.proveedor, PROVEEDOR),
  });
  const datos = row?.datos ? safeParse(row.datos) : {};
  const prev = Array.isArray(datos.sinMapear) ? datos.sinMapear : [];
  datos.sinMapear = [
    { pedido, lineas, fecha: new Date().toISOString() },
    ...prev,
  ].slice(0, 20);
  await db
    .update(integraciones)
    .set({ datos: JSON.stringify(datos) })
    .where(eq(integraciones.proveedor, PROVEEDOR));
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
