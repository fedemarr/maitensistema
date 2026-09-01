"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { planCuentas } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { cuentaInput, editarCuentaInput } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/contabilidad");
  revalidatePath("/contabilidad/plan-cuentas");
  revalidatePath("/contabilidad/balance-general");
  revalidatePath("/contabilidad/resultados");
}

export async function crearCuenta(input: unknown): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const parsed = cuentaInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const existe = await db.query.planCuentas.findFirst({
    where: eq(planCuentas.codigo, data.codigo),
    columns: { id: true },
  });
  if (existe) {
    return { ok: false, error: "Ya existe una cuenta con ese código." };
  }

  await db.insert(planCuentas).values(data);

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "plan-cuenta",
    datos: data,
  });
  revalidar();
  return { ok: true };
}

export async function editarCuenta(input: unknown): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const parsed = editarCuentaInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { id, ...data } = parsed.data;

  const repetido = await db
    .select({ id: planCuentas.id })
    .from(planCuentas)
    .where(eq(planCuentas.codigo, data.codigo))
    .then((rows) => rows.find((r) => r.id !== id));
  if (repetido) {
    return { ok: false, error: "Ya existe una cuenta con ese código." };
  }

  await db.update(planCuentas).set(data).where(eq(planCuentas.id, id));

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "plan-cuenta",
    entidadId: id,
    datos: data,
  });
  revalidar();
  return { ok: true };
}

export async function toggleCuentaActivo(id: string): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const cuenta = await db.query.planCuentas.findFirst({
    where: eq(planCuentas.id, id),
    columns: { activo: true },
  });
  if (!cuenta) return { ok: false, error: "No encontré la cuenta." };

  await db
    .update(planCuentas)
    .set({ activo: !cuenta.activo })
    .where(eq(planCuentas.id, id));

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "plan-cuenta",
    entidadId: id,
    datos: { activo: !cuenta.activo },
  });
  revalidar();
  return { ok: true };
}