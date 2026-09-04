"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { costosFijos } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { round2 } from "@/lib/stock";
import {
  costoFijoInput,
  nuevaVersionCostoFijoInput,
  type CostoFijoInput,
  type NuevaVersionCostoFijoInput,
} from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const revalidar = () => {
  revalidatePath("/costos-fijos");
  revalidatePath("/reportes");
};

/** Día anterior a `fecha` (YYYY-MM-DD). */
function diaAnterior(fecha: string) {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function crearCostoFijo(
  input: CostoFijoInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = costoFijoInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const [row] = await db
    .insert(costosFijos)
    .values({
      concepto: data.concepto,
      categoria: data.categoria,
      montoMensual: String(round2(data.montoMensual)),
      vigenteDesde: data.vigenteDesde,
      notas: data.notas,
      creadoPor: user.id,
    })
    .returning({ id: costosFijos.id });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "costo_fijo",
    entidadId: row.id,
    datos: { concepto: data.concepto, montoMensual: data.montoMensual },
  });

  revalidar();
  return { ok: true, id: row.id };
}

/** Cierra la vigencia actual y crea una nueva versión (cambió el monto o la categoría). */
export async function nuevaVersionCostoFijo(
  input: NuevaVersionCostoFijoInput,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = nuevaVersionCostoFijoInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }
  const data = parsed.data;

  const anterior = await db.query.costosFijos.findFirst({
    where: eq(costosFijos.id, data.costoFijoId),
  });
  if (!anterior) return { ok: false, error: "No encontré el costo fijo." };
  if (anterior.vigenteHasta) {
    return { ok: false, error: "Esa versión ya no está vigente." };
  }

  const nuevoId = await db.transaction(async (tx) => {
    await tx
      .update(costosFijos)
      .set({ vigenteHasta: diaAnterior(data.vigenteDesde) })
      .where(eq(costosFijos.id, anterior.id));

    const [row] = await tx
      .insert(costosFijos)
      .values({
        concepto: anterior.concepto,
        categoria: data.categoria,
        montoMensual: String(round2(data.montoMensual)),
        vigenteDesde: data.vigenteDesde,
        notas: data.notas,
        creadoPor: user.id,
      })
      .returning({ id: costosFijos.id });
    return row.id;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "costo_fijo",
    entidadId: nuevoId,
    datos: { versionDe: anterior.id, montoMensual: data.montoMensual },
  });

  revalidar();
  return { ok: true, id: nuevoId };
}

/** Da de baja un costo fijo (deja de aplicar desde la fecha indicada). */
export async function darDeBajaCostoFijo(
  id: string,
  hasta: string,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const row = await db.query.costosFijos.findFirst({
    where: eq(costosFijos.id, id),
  });
  if (!row) return { ok: false, error: "No encontré el costo fijo." };

  await db
    .update(costosFijos)
    .set({ vigenteHasta: hasta })
    .where(eq(costosFijos.id, id));

  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "costo_fijo",
    entidadId: id,
    datos: { vigenteHasta: hasta },
  });

  revalidar();
  return { ok: true, id };
}
