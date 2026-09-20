import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  clientes,
  integraciones,
  movimientos,
  preciosVenta,
  productos,
} from "@/db/schema";
import { crearMovimientoComo } from "@/features/movimientos/actions";
import { registrarAuditoria } from "@/lib/audit";
import { round2 } from "@/lib/stock";
import { getOrder } from "./api";
import { componentesDeCombo } from "./combos";
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

  // Reunir los SKU objetivo: líneas simples + componentes de cada combo.
  const skusObjetivo = new Set<string>();
  for (const l of order.products) {
    const comps = componentesDeCombo(l.sku);
    if (comps) comps.forEach((c) => skusObjetivo.add(c.sku.toLowerCase()));
    else if (l.sku) skusObjetivo.add(l.sku.toLowerCase());
  }

  // Resolver SKU -> producto y traer el precio retail vigente de cada uno
  // (se usa para repartir el precio de un combo entre sus componentes).
  const prods = skusObjetivo.size
    ? await db
        .select({ id: productos.id, sku: productos.sku })
        .from(productos)
        .where(
          and(
            eq(productos.esInsumo, false),
            sql`lower(${productos.sku}) in (${sql.join(
              [...skusObjetivo].map((s) => sql`${s}`),
              sql`, `,
            )})`,
          ),
        )
    : [];
  const idPorSku = new Map(prods.map((p) => [p.sku.toLowerCase(), p.id]));

  const retailPorSku = new Map<string, number>();
  if (prods.length) {
    const idToSku = new Map(prods.map((p) => [p.id, p.sku.toLowerCase()]));
    const precios = await db
      .select({
        productoId: preciosVenta.productoId,
        precioNeto: preciosVenta.precioNeto,
      })
      .from(preciosVenta)
      .where(
        and(
          isNull(preciosVenta.vigenteHasta),
          eq(preciosVenta.tipoLista, "retail"),
          sql`${preciosVenta.productoId} in (${sql.join(
            prods.map((p) => sql`${p.id}`),
            sql`, `,
          )})`,
        ),
      );
    for (const pr of precios) {
      const sku = idToSku.get(pr.productoId);
      if (sku) retailPorSku.set(sku, Number(pr.precioNeto));
    }
  }

  // Aplanar cada línea del pedido en subrenglones a nivel producto del
  // sistema, resolviendo combos. Tiendanube guarda el precio con IVA.
  type Sub = { pid: string; cantidad: number; netoUnit: number };
  const subs: Sub[] = [];
  const sinMapear: string[] = [];

  for (const l of order.products) {
    const comps = componentesDeCombo(l.sku);
    if (comps) {
      const netoComboUnit = round2(Number(l.price) / IVA);
      const netosUnit = repartirCombo(netoComboUnit, comps, retailPorSku);
      comps.forEach((c, i) => {
        const pid = idPorSku.get(c.sku.toLowerCase());
        if (!pid) {
          sinMapear.push(`${l.name} → componente ${c.sku} sin producto`);
          return;
        }
        subs.push({
          pid,
          cantidad: l.quantity * c.cantidad,
          netoUnit: netosUnit[i],
        });
      });
      continue;
    }
    const pid = l.sku ? idPorSku.get(l.sku.toLowerCase()) : undefined;
    if (!pid) {
      sinMapear.push(`${l.name}${l.sku ? ` (SKU ${l.sku})` : " (sin SKU)"}`);
      continue;
    }
    subs.push({
      pid,
      cantidad: l.quantity,
      netoUnit: round2(Number(l.price) / IVA),
    });
  }

  // Fusionar subrenglones por producto (precio neto por unidad = promedio
  // ponderado por cantidad).
  const porProducto = new Map<string, { cantidad: number; netoTotal: number }>();
  for (const s of subs) {
    const e = porProducto.get(s.pid) ?? { cantidad: 0, netoTotal: 0 };
    e.cantidad += s.cantidad;
    e.netoTotal += s.cantidad * s.netoUnit;
    porProducto.set(s.pid, e);
  }
  const items = [...porProducto.entries()].map(([productoId, e]) => ({
    productoId,
    cantidad: e.cantidad,
    precioNeto: round2(e.netoTotal / e.cantidad),
  }));

  if (sinMapear.length) {
    await anotarSinMapear(order.number, sinMapear);
  }
  if (items.length === 0) {
    return { ok: true, estado: "sin_mapear" };
  }

  const clienteId = await clienteDelPedido(
    order.contact_name,
    order.contact_email,
    order.contact_identification,
  );

  const res = await crearMovimientoComo(
    {
      tipo: "venta",
      fecha: order.created_at.slice(0, 10),
      clienteId,
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

/**
 * Cliente de la venta online. Si el comprador cargó DNI/CUIT en el checkout,
 * se busca (o crea) un cliente con ese documento: así la factura de AFIP sale
 * identificando al comprador. Sin documento, queda el genérico "Consumidor
 * final (Tienda Nube)". Devuelve "" si ni el genérico existe.
 */
async function clienteDelPedido(
  nombre: string | null,
  email: string | null,
  identificacion: string | null,
): Promise<string> {
  const doc = (identificacion ?? "").replace(/\D/g, "");
  // DNI (7-8 dígitos) o CUIT (11); cualquier otra cosa se ignora.
  if (doc.length === 7 || doc.length === 8 || doc.length === 11) {
    const existente = await db.query.clientes.findFirst({
      where: sql`regexp_replace(${clientes.cuit}, '\\D', '', 'g') = ${doc}`,
      columns: { id: true },
    });
    if (existente) return existente.id;

    const [nuevo] = await db
      .insert(clientes)
      .values({
        nombre: nombre?.trim() || `Comprador Tienda Nube ${doc}`,
        tipo: "particular",
        email: email || null,
        cuit: doc,
        condicionIva: "consumidor_final",
        notas: "Alta automática desde Tienda Nube",
      })
      .returning({ id: clientes.id });
    return nuevo.id;
  }

  const generico = await db.query.clientes.findFirst({
    where: sql`lower(${clientes.nombre}) = lower(${CLIENTE_TN})`,
    columns: { id: true },
  });
  return generico?.id ?? "";
}

/**
 * Reparte el precio neto de un combo (por unidad) entre sus componentes,
 * ponderando por el precio retail vigente de cada uno; si no hay precios,
 * reparte por cantidad de unidades. El redondeo sobrante se ajusta en el
 * último componente para que la suma cuadre. Devuelve el neto POR UNIDAD
 * de cada componente.
 */
function repartirCombo(
  netoComboUnit: number,
  comps: { sku: string; cantidad: number }[],
  retailPorSku: Map<string, number>,
): number[] {
  const pesos = comps.map(
    (c) => (retailPorSku.get(c.sku.toLowerCase()) ?? 0) * c.cantidad,
  );
  const base = pesos.some((p) => p > 0) ? pesos : comps.map((c) => c.cantidad);
  const sumaBase = base.reduce((a, b) => a + b, 0) || 1;

  const totales: number[] = [];
  let acumulado = 0;
  for (let i = 0; i < comps.length; i++) {
    const total =
      i < comps.length - 1
        ? round2((netoComboUnit * base[i]) / sumaBase)
        : round2(netoComboUnit - acumulado);
    totales.push(total);
    acumulado += total;
  }
  return totales.map((t, i) => round2(t / comps[i].cantidad));
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
