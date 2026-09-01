"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { proveedores } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { contarMovimientosDeProveedor, nombreEnUso } from "./queries";
import { proveedorInput, type ProveedorInput } from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function guardarProveedor(
  input: ProveedorInput,
  id?: string,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = proveedorInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  if (await nombreEnUso(data.nombre, id)) {
    return {
      ok: false,
      error: `Ya existe un proveedor con el nombre "${data.nombre}".`,
    };
  }

  const proveedorId = await db.transaction(async (tx) => {
    let pid = id;

    if (pid) {
      await tx
        .update(proveedores)
        .set({
          nombre: data.nombre,
          cuit: data.cuit,
          email: data.email,
          telefono: data.telefono,
          notas: data.notas,
        })
        .where(eq(proveedores.id, pid));
    } else {
      const [row] = await tx
        .insert(proveedores)
        .values({
          nombre: data.nombre,
          cuit: data.cuit,
          email: data.email,
          telefono: data.telefono,
          notas: data.notas,
        })
        .returning({ id: proveedores.id });
      pid = row.id;
    }

    return pid;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: id ? "editar" : "crear",
    entidad: "proveedor",
    entidadId: proveedorId,
    datos: { nombre: data.nombre },
  });

  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${proveedorId}`);
  return { ok: true, id: proveedorId };
}

export async function toggleProveedorActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);
  await db.update(proveedores).set({ activo }).where(eq(proveedores.id, id));
  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "proveedor",
    entidadId: id,
    datos: { activo },
  });
  revalidatePath("/proveedores");
  revalidatePath(`/proveedores/${id}`);
  return { ok: true, id };
}

export async function eliminarProveedor(id: string): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const movimientos = await contarMovimientosDeProveedor(id);
  if (movimientos > 0) {
    return {
      ok: false,
      error:
        "El proveedor tiene movimientos registrados. Marcá el proveedor como inactivo en lugar de eliminarlo.",
    };
  }

  await db.delete(proveedores).where(eq(proveedores.id, id));

  await registrarAuditoria({
    actorId: user.id,
    accion: "borrar",
    entidad: "proveedor",
    entidadId: id,
  });

  revalidatePath("/proveedores");
  return { ok: true, id };
}
