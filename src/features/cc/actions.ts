"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { ccMovimientos, mediosPago } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

const medioOpcional = z
  .union([z.uuid(), z.literal(""), z.literal("__none__")])
  .optional()
  .transform((v) => (v && v !== "__none__" ? v : null));

const pagoInput = z.object({
  entidadTipo: z.enum(["cliente", "proveedor"]),
  entidadId: z.uuid("La entidad es requerida."),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0."),
  fecha: z.string().min(1, "La fecha es obligatoria."),
  medioPagoId: medioOpcional,
  concepto: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
});

export type PagoInput = z.infer<typeof pagoInput>;

/**
 * Registra el contra-asiento de un pago/adelanto en la cuenta corriente:
 * haber para un cliente (paga lo que debía), debe para un proveedor.
 */
export async function registrarPago(input: PagoInput): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = pagoInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos de pago inválidos." };
  }
  const { entidadTipo, entidadId, monto, fecha, medioPagoId, concepto } =
    parsed.data;

  const esCliente = entidadTipo === "cliente";
  let textoMedio = "";
  if (medioPagoId) {
    const medio = await db.query.mediosPago.findFirst({
      where: eq(mediosPago.id, medioPagoId),
      columns: { nombre: true },
    });
    textoMedio = medio ? ` · ${medio.nombre}` : "";
  }

  const textoBase = esCliente
    ? "Pago recibido de cliente"
    : "Pago a proveedor";
  const texto = concepto ?? `${textoBase}${textoMedio}`;

  await db.insert(ccMovimientos).values({
    entidadTipo,
    entidadId,
    fecha,
    debe: esCliente ? "0" : String(monto),
    haber: esCliente ? String(monto) : "0",
    concepto: texto,
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "cc-pago",
    entidadId,
    datos: { entidadTipo, monto, fecha, medioPagoId },
  });

  const rutaBase = esCliente ? "/cc-clientes" : "/cc-proveedores";
  revalidatePath(rutaBase);
  revalidatePath(`${rutaBase}/${entidadId}`);
  return { ok: true };
}