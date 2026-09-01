"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { rubros } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";

const nombreSchema = z.string().trim().min(1, "Poné un nombre.").max(60);

export async function crearRubro(nombre: string) {
  const user = await requireRole(["admin", "ventas"]);
  const parsed = nombreSchema.safeParse(nombre);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const existe = await db.query.rubros.findFirst({
    where: eq(rubros.nombre, parsed.data),
  });
  if (existe) return { ok: false as const, error: "Ya existe un rubro con ese nombre." };

  const [row] = await db
    .insert(rubros)
    .values({ nombre: parsed.data })
    .returning({ id: rubros.id });

  await registrarAuditoria({
    actorId: user.id,
    accion: "crear",
    entidad: "rubro",
    entidadId: row.id,
    datos: { nombre: parsed.data },
  });
  revalidatePath("/config/rubros");
  revalidatePath("/productos");
  return { ok: true as const, id: row.id };
}

export async function toggleRubroActivo(id: string, activo: boolean) {
  const user = await requireRole(["admin", "ventas"]);
  await db.update(rubros).set({ activo }).where(eq(rubros.id, id));
  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "rubro",
    entidadId: id,
    datos: { activo },
  });
  revalidatePath("/config/rubros");
  return { ok: true as const };
}
