import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  asientoLineas,
  asientos,
  bajasInsumo,
  ccMovimientos,
  comprasInsumo,
  movimientoItems,
  movimientos,
  ordenesProduccion,
  planCuentas,
  productos,
} from "@/db/schema";
import { reglaDe, TIPO_LABEL, type TipoManual } from "@/features/movimientos/schema";
import { CUENTAS, redondear } from "../schema";

/** Tipo de la transacción de Drizzle (el mismo que recibe `db.transaction`). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type LineaSpec = { codigo: string; debe: number; haber: number; concepto?: string };

/** Cuenta de caja/banco según el medio de pago. `credito` → null (lo resuelve el llamador). */
function cuentaMedioPago(medioPago: string | null | undefined): string | null {
  switch (medioPago) {
    case "efectivo":
      return CUENTAS.caja;
    case "transferencia":
    case "mercado_pago":
    case "tienda_nube":
      return CUENTAS.banco;
    default:
      return null; // credito o sin especificar
  }
}

function monto(n: number): string {
  return redondear(n).toFixed(2);
}

/**
 * Inserta un asiento balanceado. Resuelve los códigos de cuenta, valida que
 * debe == haber y que no haya líneas en cero. Lanza (rollback) si algo falla.
 */
async function insertarAsiento(
  tx: Tx,
  args: {
    fecha: string;
    descripcion: string;
    origen: string;
    creadorId: string | null;
    ref?: Partial<{
      movimientoId: string;
      compraId: string;
      ordenId: string;
      ccMovimientoId: string;
      bajaId: string;
    }>;
    lineas: LineaSpec[];
  },
): Promise<string | null> {
  const lineas = args.lineas.filter(
    (l) => redondear(l.debe) !== 0 || redondear(l.haber) !== 0,
  );
  if (lineas.length === 0) return null;

  const totalDebe = lineas.reduce((a, l) => a + redondear(l.debe), 0);
  const totalHaber = lineas.reduce((a, l) => a + redondear(l.haber), 0);
  if (Math.abs(totalDebe - totalHaber) > 0.005) {
    throw new Error(
      `Asiento desbalanceado (${args.descripcion}): debe ${totalDebe} vs haber ${totalHaber}.`,
    );
  }

  const codigos = [...new Set(lineas.map((l) => l.codigo))];
  const cuentas = await tx
    .select({ id: planCuentas.id, codigo: planCuentas.codigo })
    .from(planCuentas);
  const idPorCodigo = new Map(cuentas.map((c) => [c.codigo, c.id]));
  for (const c of codigos) {
    if (!idPorCodigo.has(c)) {
      throw new Error(`Falta la cuenta contable "${c}" en el plan de cuentas.`);
    }
  }

  const [asiento] = await tx
    .insert(asientos)
    .values({
      fecha: args.fecha,
      descripcion: args.descripcion,
      origen: args.origen,
      creadoPor: args.creadorId,
      movimientoId: args.ref?.movimientoId ?? null,
      compraId: args.ref?.compraId ?? null,
      ordenId: args.ref?.ordenId ?? null,
      ccMovimientoId: args.ref?.ccMovimientoId ?? null,
      bajaId: args.ref?.bajaId ?? null,
    })
    .returning({ id: asientos.id });

  await tx.insert(asientoLineas).values(
    lineas.map((l) => ({
      asientoId: asiento.id,
      cuentaId: idPorCodigo.get(l.codigo)!,
      debe: monto(l.debe),
      haber: monto(l.haber),
      concepto: l.concepto ?? null,
    })),
  );

  return asiento.id;
}

/**
 * Asiento de un movimiento de stock ya insertado con sus ítems.
 * `produccion` no genera asiento acá (lo hace `generarAsientoProduccion`).
 */
export async function generarAsientoMovimiento(
  tx: Tx,
  movimientoId: string,
  creadorId: string,
): Promise<string | null> {
  const mov = await tx.query.movimientos.findFirst({
    where: eq(movimientos.id, movimientoId),
    columns: { tipo: true, fecha: true, medioPago: true },
  });
  if (!mov) throw new Error("No encontré el movimiento.");
  if (mov.tipo === "produccion") return null;

  const tipo = mov.tipo as TipoManual;
  const regla = reglaDe(tipo);

  const items = await tx
    .select({
      cantidad: movimientoItems.cantidad,
      precioConIva: movimientoItems.precioConIva,
      costo: movimientoItems.costo,
      ppp: productos.ppp,
    })
    .from(movimientoItems)
    .innerJoin(productos, eq(productos.id, movimientoItems.productoId))
    .where(eq(movimientoItems.movimientoId, movimientoId));

  let costoTotal = 0;
  let totalConIva = 0;
  for (const it of items) {
    const abs = Math.abs(it.cantidad);
    const c = Number(it.costo) || abs * Number(it.ppp);
    costoTotal += c;
    totalConIva += abs * (Number(it.precioConIva) || 0);
  }
  costoTotal = redondear(costoTotal);
  totalConIva = redondear(totalConIva);

  const desc = `${TIPO_LABEL[tipo]} ${movimientoId.slice(0, 8)}`;
  const ref = { movimientoId };
  const base = { fecha: mov.fecha, descripcion: desc, origen: "movimiento", creadorId, ref };

  // Venta / venta desde consignación → CMV + Ventas.
  if (regla.impacto === "ingreso") {
    const cuentaMerc =
      regla.consig === "vender"
        ? CUENTAS.mercaderiaConsignacion
        : CUENTAS.mercaderia;
    const cuentaCobro =
      mov.medioPago === "credito"
        ? CUENTAS.deudoresPorVentas
        : (cuentaMedioPago(mov.medioPago) ?? CUENTAS.caja);
    return insertarAsiento(tx, {
      ...base,
      lineas: [
        { codigo: CUENTAS.cmv, debe: costoTotal, haber: 0, concepto: "Costo de la mercadería vendida" },
        { codigo: cuentaMerc, debe: 0, haber: costoTotal, concepto: "Baja de mercadería" },
        { codigo: cuentaCobro, debe: totalConIva, haber: 0 },
        { codigo: CUENTAS.ventas, debe: 0, haber: totalConIva },
      ],
    });
  }

  // Salidas no-venta y co-branding → Gasto / Mercadería.
  if (regla.impacto === "salida_no_venta" || regla.impacto === "co_branding") {
    return insertarAsiento(tx, {
      ...base,
      lineas: [
        { codigo: CUENTAS.gastosOperativos, debe: costoTotal, haber: 0 },
        { codigo: CUENTAS.mercaderia, debe: 0, haber: costoTotal },
      ],
    });
  }

  // Consignación (entrega/devolución) → transferencia entre cuentas de Mercadería.
  if (regla.impacto === "neutro") {
    if (regla.consig === "entregar") {
      return insertarAsiento(tx, {
        ...base,
        lineas: [
          { codigo: CUENTAS.mercaderiaConsignacion, debe: costoTotal, haber: 0 },
          { codigo: CUENTAS.mercaderia, debe: 0, haber: costoTotal },
        ],
      });
    }
    if (regla.consig === "devolver") {
      return insertarAsiento(tx, {
        ...base,
        lineas: [
          { codigo: CUENTAS.mercaderia, debe: costoTotal, haber: 0 },
          { codigo: CUENTAS.mercaderiaConsignacion, debe: 0, haber: costoTotal },
        ],
      });
    }
    return null;
  }

  // Ajuste: suma → carga inicial (Mercadería / Capital); resta → pérdida.
  if (regla.impacto === "ajuste") {
    const suma = items.some((it) => it.cantidad > 0);
    return insertarAsiento(tx, {
      ...base,
      lineas: suma
        ? [
            { codigo: CUENTAS.mercaderia, debe: costoTotal, haber: 0 },
            { codigo: CUENTAS.capitalInicial, debe: 0, haber: costoTotal },
          ]
        : [
            { codigo: CUENTAS.gastosOperativos, debe: costoTotal, haber: 0 },
            { codigo: CUENTAS.mercaderia, debe: 0, haber: costoTotal },
          ],
    });
  }

  return null;
}

/** Compra de insumos → Mercadería / (Caja|Banco o Proveedores a pagar). */
export async function generarAsientoCompra(
  tx: Tx,
  compraId: string,
  creadorId: string,
): Promise<string | null> {
  const compra = await tx.query.comprasInsumo.findFirst({
    where: eq(comprasInsumo.id, compraId),
    columns: { fecha: true, total: true, medioPago: true },
  });
  if (!compra) throw new Error("No encontré la compra.");

  const total = redondear(Number(compra.total));
  const contra =
    compra.medioPago === "credito"
      ? CUENTAS.proveedoresAPagar
      : (cuentaMedioPago(compra.medioPago) ?? CUENTAS.caja);

  return insertarAsiento(tx, {
    fecha: compra.fecha,
    descripcion: `Compra de insumos ${compraId.slice(0, 8)}`,
    origen: "compra",
    creadorId,
    ref: { compraId },
    lineas: [
      { codigo: CUENTAS.mercaderia, debe: total, haber: 0 },
      { codigo: contra, debe: 0, haber: total },
    ],
  });
}

/**
 * Cierre de orden de producción. El consumo de insumos y la entrada de
 * terminado son neutros dentro de Mercadería; solo la fabricación cobrada
 * es un hecho de caja que capitaliza en el valor del terminado.
 */
export async function generarAsientoProduccion(
  tx: Tx,
  ordenId: string,
  creadorId: string,
): Promise<string | null> {
  const orden = await tx.query.ordenesProduccion.findFirst({
    where: eq(ordenesProduccion.id, ordenId),
    columns: { fechaCierre: true, fechaPrevista: true, fabricacionCobrada: true },
  });
  if (!orden) throw new Error("No encontré la orden.");

  const fab = redondear(Number(orden.fabricacionCobrada ?? 0));
  if (fab === 0) return null;

  return insertarAsiento(tx, {
    fecha: orden.fechaCierre ?? orden.fechaPrevista,
    descripcion: `Fabricación · orden ${ordenId.slice(0, 8)}`,
    origen: "produccion",
    creadorId,
    ref: { ordenId },
    lineas: [
      { codigo: CUENTAS.mercaderia, debe: fab, haber: 0, concepto: "Fabricación capitalizada en el terminado" },
      { codigo: CUENTAS.caja, debe: 0, haber: fab, concepto: "Pago a la fábrica" },
    ],
  });
}

/** Baja de insumo → Pérdida por insumos / Mercadería. */
export async function generarAsientoBaja(
  tx: Tx,
  bajaId: string,
  creadorId: string,
): Promise<string | null> {
  const baja = await tx.query.bajasInsumo.findFirst({
    where: eq(bajasInsumo.id, bajaId),
    columns: { fecha: true, monto: true },
  });
  if (!baja) throw new Error("No encontré la baja.");

  const m = redondear(Number(baja.monto));
  return insertarAsiento(tx, {
    fecha: baja.fecha,
    descripcion: `Baja de insumo ${bajaId.slice(0, 8)}`,
    origen: "baja",
    creadorId,
    ref: { bajaId },
    lineas: [
      { codigo: CUENTAS.perdidaInsumos, debe: m, haber: 0 },
      { codigo: CUENTAS.mercaderia, debe: 0, haber: m },
    ],
  });
}

/** Cobro de cliente (haber en su CC) → Caja|Banco / Deudores por ventas. */
export async function generarAsientoCobro(
  tx: Tx,
  ccMovimientoId: string,
  creadorId: string,
): Promise<string | null> {
  const cc = await tx.query.ccMovimientos.findFirst({
    where: eq(ccMovimientos.id, ccMovimientoId),
    columns: { fecha: true, haber: true, medioPago: true },
  });
  if (!cc) throw new Error("No encontré el movimiento de cuenta corriente.");

  const m = redondear(Number(cc.haber));
  return insertarAsiento(tx, {
    fecha: cc.fecha,
    descripcion: `Cobro ${ccMovimientoId.slice(0, 8)}`,
    origen: "cobro",
    creadorId,
    ref: { ccMovimientoId },
    lineas: [
      { codigo: cuentaMedioPago(cc.medioPago) ?? CUENTAS.caja, debe: m, haber: 0 },
      { codigo: CUENTAS.deudoresPorVentas, debe: 0, haber: m },
    ],
  });
}

/** Pago a proveedor (debe en su CC) → Proveedores a pagar / Caja|Banco. */
export async function generarAsientoPago(
  tx: Tx,
  ccMovimientoId: string,
  creadorId: string,
): Promise<string | null> {
  const cc = await tx.query.ccMovimientos.findFirst({
    where: eq(ccMovimientos.id, ccMovimientoId),
    columns: { fecha: true, debe: true, medioPago: true },
  });
  if (!cc) throw new Error("No encontré el movimiento de cuenta corriente.");

  const m = redondear(Number(cc.debe));
  return insertarAsiento(tx, {
    fecha: cc.fecha,
    descripcion: `Pago a proveedor ${ccMovimientoId.slice(0, 8)}`,
    origen: "pago",
    creadorId,
    ref: { ccMovimientoId },
    lineas: [
      { codigo: CUENTAS.proveedoresAPagar, debe: m, haber: 0 },
      { codigo: cuentaMedioPago(cc.medioPago) ?? CUENTAS.caja, debe: 0, haber: m },
    ],
  });
}
