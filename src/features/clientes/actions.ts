"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { clientes } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { contarMovimientosDeCliente, nombreEnUso } from "./queries";
import { clienteInput, type ClienteInput } from "./schema";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function guardarCliente(
  input: ClienteInput,
  id?: string,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);

  const parsed = clienteInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  if (await nombreEnUso(data.nombre, id)) {
    return { ok: false, error: `Ya existe un cliente con el nombre "${data.nombre}".` };
  }

  const clienteId = await db.transaction(async (tx) => {
    let cid = id;

    if (cid) {
      await tx
        .update(clientes)
        .set({
          nombre: data.nombre,
          tipo: data.tipo,
          email: data.email,
          telefono: data.telefono,
          cuit: data.cuit,
          notas: data.notas,
        })
        .where(eq(clientes.id, cid));
    } else {
      const [row] = await tx
        .insert(clientes)
        .values({
          nombre: data.nombre,
          tipo: data.tipo,
          email: data.email,
          telefono: data.telefono,
          cuit: data.cuit,
          notas: data.notas,
        })
        .returning({ id: clientes.id });
      cid = row.id;
    }

    return cid;
  });

  await registrarAuditoria({
    actorId: user.id,
    accion: id ? "editar" : "crear",
    entidad: "cliente",
    entidadId: clienteId,
    datos: { nombre: data.nombre, tipo: data.tipo },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true, id: clienteId };
}

export async function toggleClienteActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  const user = await requireRole(["admin", "ventas"]);
  await db.update(clientes).set({ activo }).where(eq(clientes.id, id));
  await registrarAuditoria({
    actorId: user.id,
    accion: "editar",
    entidad: "cliente",
    entidadId: id,
    datos: { activo },
  });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true, id };
}

export async function eliminarCliente(id: string): Promise<ActionResult> {
  const user = await requireRole(["admin"]);

  const movimientos = await contarMovimientosDeCliente(id);
  if (movimientos > 0) {
    return {
      ok: false,
      error:
        "El cliente tiene movimientos registrados. Marcá el cliente como inactivo en lugar de eliminarlo.",
    };
  }

  await db.delete(clientes).where(eq(clientes.id, id));

  await registrarAuditoria({
    actorId: user.id,
    accion: "borrar",
    entidad: "cliente",
    entidadId: id,
  });

  revalidatePath("/clientes");
  return { ok: true, id };
}
