"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { ccMovimientos } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { round2 } from "@/lib/stock";
import {
  ajusteCcInput,
  cobroInput,
  pagoInput,
  type AjusteCcInput,
  type CobroInput,
  type PagoInput,
} from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function registrarCobro(input: CobroInput): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = cobroInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const [row] = await db
    .insert(ccMovimientos)
    .values({
      entidadTipo: "cliente",
      entidadId: data.clienteId,
      fecha: data.fecha,
      concepto: data.concepto ?? "Cobro",
      debe: "0",
      haber: String(round2(data.monto)),
      origen: "cobro",
      medioPago: data.medioPago,
      creadoPor: user.id,
    })
    .returning({ id: ccMovimientos.id });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "cc_movimiento",
    entidadId: row.id,
    datos: { entidadTipo: "cliente", clienteId: data.clienteId, monto: data.monto },
  });

  revalidatePath(`/clientes/${data.clienteId}`);
  revalidatePath("/clientes");
  return { ok: true, id: row.id };
}

export async function registrarPago(input: PagoInput): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = pagoInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const [row] = await db
    .insert(ccMovimientos)
    .values({
      entidadTipo: "proveedor",
      entidadId: data.proveedorId,
      fecha: data.fecha,
      concepto: data.concepto ?? "Pago",
      debe: String(round2(data.monto)),
      haber: "0",
      origen: "pago",
      medioPago: data.medioPago,
      creadoPor: user.id,
    })
    .returning({ id: ccMovimientos.id });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "cc_movimiento",
    entidadId: row.id,
    datos: { entidadTipo: "proveedor", proveedorId: data.proveedorId, monto: data.monto },
  });

  revalidatePath(`/proveedores/${data.proveedorId}`);
  revalidatePath("/proveedores");
  return { ok: true, id: row.id };
}

/** Ajuste manual del saldo (ver convención de signo en el schema). Solo admin. */
export async function registrarAjusteCc(
  input: AjusteCcInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const parsed = ajusteCcInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const aumenta = data.monto > 0;
  const monto = String(round2(Math.abs(data.monto)));
  const esDebe =
    (data.entidadTipo === "cliente" && aumenta) ||
    (data.entidadTipo === "proveedor" && !aumenta);

  const [row] = await db
    .insert(ccMovimientos)
    .values({
      entidadTipo: data.entidadTipo,
      entidadId: data.entidadId,
      fecha: data.fecha,
      concepto: data.concepto,
      debe: esDebe ? monto : "0",
      haber: esDebe ? "0" : monto,
      origen: "ajuste",
      creadoPor: user.id,
    })
    .returning({ id: ccMovimientos.id });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "cc_movimiento",
    entidadId: row.id,
    datos: { entidadTipo: data.entidadTipo, entidadId: data.entidadId, monto: data.monto },
  });

  const base = data.entidadTipo === "cliente" ? "/clientes" : "/proveedores";
  revalidatePath(`${base}/${data.entidadId}`);
  revalidatePath(base);
  return { ok: true, id: row.id };
}
