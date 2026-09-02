import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  asientoLineas,
  asientos,
  mediosPago,
  movimientoItems,
  movimientos,
  planCuentas,
} from "@/db/schema";
import type { TipoMovimiento } from "@/features/movimientos/schema";
import { TIPO_LABEL } from "@/features/movimientos/schema";
import { CUENTAS, redondear } from "../schema";

/** Tipo de la transacción de Drizzle (el mismo que recibe `db.transaction`). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Linea = {
  cuentaId: string;
  debe: string;
  haber: string;
  concepto?: string;
};

async function cuentaPorCodigo(tx: Tx, codigo: string): Promise<string> {
  const row = await tx.query.planCuentas.findFirst({
    where: eq(planCuentas.codigo, codigo),
    columns: { id: true },
  });
  if (!row) {
    throw new Error(`Falta la cuenta contable "${codigo}" en el plan de cuentas.`);
  }
  return row.id;
}

/** Número → string con 2 decimales (formato de `numeric(12,2)`). */
function monto(n: number): string {
  return redondear(n).toFixed(2);
}

function costoItems(
  items: { cantidad: number; costoUnit: string }[],
): number {
  return items.reduce((a, i) => a + Number(i.costoUnit) * i.cantidad, 0);
}

/**
 * Cuenta de "caja o banco" que se debita/credita según el medio de pago.
 * Si el medio es crédito o no tiene cuenta mapeada, usa Caja por defecto.
 */
async function cuentaPago(tx: Tx, medioPagoId: string | null | undefined) {
  if (medioPagoId) {
    const medio = await tx.query.mediosPago.findFirst({
      where: eq(mediosPago.id, medioPagoId),
      columns: { esCredito: true, cuentaId: true },
    });
    if (medio && !medio.esCredito) {
      if (!medio.cuentaId) return cuentaPorCodigo(tx, CUENTAS.caja);
      return medio.cuentaId;
    }
  }
  return cuentaPorCodigo(tx, CUENTAS.caja);
}

/** ¿El medio es a crédito (CC)? */
async function esCredito(tx: Tx, medioPagoId: string | null | undefined) {
  if (!medioPagoId) return false;
  const medio = await tx.query.mediosPago.findFirst({
    where: eq(mediosPago.id, medioPagoId),
    columns: { esCredito: true },
  });
  return medio?.esCredito ?? false;
}

/**
 * Genera el asiento automático para un movimiento ya insertado (y con sus
 * ítems). Se llama DENTRO de la misma transacción. Devuelve el id del asiento,
 * o null si el tipo no genera asiento (ajuste: son movimientos de
 * conciliación y no tocan los libros).
 *
 * Reglas (ver docs/contabilidad-diseno.md):
 *  - venta           → Debe CMV / Haber Mercadería (o Mercadería en consignación
 *                      si la venta viene de una consignación) + Debe Caja|Banco|
 *                      Deudores por ventas / Haber Ventas.
 *  - ingreso         → Debe Mercadería / Haber Caja|Banco|Proveedores a pagar.
 *  - consignacion    → Mercadería → Mercadería en consignación.
 *  - devolucion...   → Mercadería en consignación → Mercadería.
 *  - canje/presentacion/regalo/rotura → Debe Gastos operativos / Haber Mercadería.
 */
export async function generarAsientoMovimiento(
  tx: Tx,
  movimientoId: string,
  creadorId: string,
): Promise<string | null> {
  const mov = await tx.query.movimientos.findFirst({
    where: eq(movimientos.id, movimientoId),
    columns: {
      tipo: true,
      fecha: true,
      total: true,
      medioPagoId: true,
      proveedorId: true,
      consignacionId: true,
      clienteId: true,
    },
  });
  if (!mov) throw new Error("No encontré el movimiento.");

  const tipo = mov.tipo as TipoMovimiento;
  // `ajuste` y `produccion` no generan asiento: el primero es conciliación de
  // stock; el segundo mueve valor dentro de Mercadería (insumo → terminado).
  if (tipo === "ajuste" || tipo === "produccion") return null;

  const items = await tx
    .select({
      cantidad: movimientoItems.cantidad,
      costoUnit: movimientoItems.costoUnit,
    })
    .from(movimientoItems)
    .where(eq(movimientoItems.movimientoId, movimientoId));

  const costo = costoItems(items);
  const esVentaConsignacion = tipo === "venta" && Boolean(mov.consignacionId);

  const lineas: Linea[] = [];

  if (tipo === "venta") {
    const total = Number(mov.total);
    const cmv = await cuentaPorCodigo(tx, CUENTAS.cmv);
    const mercaderia = await cuentaPorCodigo(
      tx,
      esVentaConsignacion ? CUENTAS.mercaderiaConsignacion : CUENTAS.mercaderia,
    );
    if (costo > 0) {
      lineas.push({ cuentaId: cmv, debe: monto(costo), haber: "0.00", concepto: "Costo de venta" });
      lineas.push({ cuentaId: mercaderia, debe: "0.00", haber: monto(costo), concepto: "Baja por venta" });
    }
    if (total > 0) {
      const contra = (await esCredito(tx, mov.medioPagoId))
        ? await cuentaPorCodigo(tx, CUENTAS.deudoresPorVentas)
        : await cuentaPago(tx, mov.medioPagoId);
      const ventas = await cuentaPorCodigo(tx, CUENTAS.ventas);
      lineas.push({ cuentaId: contra, debe: monto(total), haber: "0.00", concepto: "Importe cobrado/cuenta" });
      lineas.push({ cuentaId: ventas, debe: "0.00", haber: monto(total), concepto: "Venta" });
    }
  } else if (tipo === "ingreso") {
    const total = Number(mov.total);
    if (total > 0) {
      const mercaderia = await cuentaPorCodigo(tx, CUENTAS.mercaderia);
      const contra = (await esCredito(tx, mov.medioPagoId))
        ? await cuentaPorCodigo(tx, CUENTAS.proveedoresAPagar)
        : await cuentaPago(tx, mov.medioPagoId);
      lineas.push({ cuentaId: mercaderia, debe: monto(total), haber: "0.00", concepto: "Compra de mercadería" });
      lineas.push({ cuentaId: contra, debe: "0.00", haber: monto(total), concepto: "Compra" });
    }
  } else if (tipo === "consignacion" || tipo === "devolucion_consignacion") {
    if (costo > 0) {
      const mercaderia = await cuentaPorCodigo(tx, CUENTAS.mercaderia);
      const enConsignacion = await cuentaPorCodigo(tx, CUENTAS.mercaderiaConsignacion);
      const esEntrega = tipo === "consignacion";
      lineas.push({
        cuentaId: esEntrega ? enConsignacion : mercaderia,
        debe: monto(costo),
        haber: "0.00",
        concepto: esEntrega ? "Entrega en consignación" : "Devolución de consignación",
      });
      lineas.push({
        cuentaId: esEntrega ? mercaderia : enConsignacion,
        debe: "0.00",
        haber: monto(costo),
        concepto: esEntrega ? "Salida a consignación" : "Reingreso a Mercadería",
      });
    }
  } else if (
    tipo === "canje" ||
    tipo === "presentacion" ||
    tipo === "regalo" ||
    tipo === "rotura"
  ) {
    if (costo > 0) {
      const gastos = await cuentaPorCodigo(tx, CUENTAS.gastosOperativos);
      const mercaderia = await cuentaPorCodigo(tx, CUENTAS.mercaderia);
      lineas.push({ cuentaId: gastos, debe: monto(costo), haber: "0.00", concepto: TIPO_LABEL[tipo] });
      lineas.push({ cuentaId: mercaderia, debe: "0.00", haber: monto(costo), concepto: "Consumo de stock" });
    }
  }

  if (lineas.length === 0) return null;

  const [asiento] = await tx
    .insert(asientos)
    .values({
      fecha: mov.fecha,
      descripcion: esVentaConsignacion
        ? `${TIPO_LABEL[tipo]} (consignación)`
        : TIPO_LABEL[tipo],
      origen: "movimiento",
      estado: "confirmado",
      movimientoId,
      creadoPor: creadorId,
    })
    .returning({ id: asientos.id });

  await tx.insert(asientoLineas).values(
    lineas.map((l) => ({
      asientoId: asiento.id,
      cuentaId: l.cuentaId,
      debe: l.debe,
      haber: l.haber,
      concepto: l.concepto,
    })),
  );

  return asiento.id;
}

/**
 * Asiento de un pago de cuenta corriente: pago de cliente (debe Caja/Banco,
 * haber Deudores por ventas) o pago a proveedor (debe Proveedores a pagar,
 * haber Caja/Banco). Se llama DENTRO de la transacción que registra el pago.
 */
export async function generarAsientoPago(
  tx: Tx,
  input: {
    fecha: string;
    esCliente: boolean;
    monto: number;
    medioPagoId: string | null;
    descripcion: string;
    creadorId: string;
  },
): Promise<string> {
  const contra = input.esCliente
    ? await cuentaPorCodigo(tx, CUENTAS.deudoresPorVentas)
    : await cuentaPorCodigo(tx, CUENTAS.proveedoresAPagar);
  const pago = await cuentaPago(tx, input.medioPagoId);

  const [asiento] = await tx
    .insert(asientos)
    .values({
      fecha: input.fecha,
      descripcion: input.descripcion,
      origen: "cc-pago",
      estado: "confirmado",
      creadoPor: input.creadorId,
    })
    .returning({ id: asientos.id });

  await tx.insert(asientoLineas).values([
    input.esCliente
      ? { asientoId: asiento.id, cuentaId: pago, debe: monto(input.monto), haber: "0.00", concepto: "Pago recibido de cliente" }
      : { asientoId: asiento.id, cuentaId: contra, debe: monto(input.monto), haber: "0.00", concepto: "Pago a proveedor" },
    input.esCliente
      ? { asientoId: asiento.id, cuentaId: contra, debe: "0.00", haber: monto(input.monto), concepto: "Compensación de deuda" }
      : { asientoId: asiento.id, cuentaId: pago, debe: "0.00", haber: monto(input.monto), concepto: "Pago a proveedor" },
  ]);

  return asiento.id;
}