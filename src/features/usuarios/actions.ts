"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { perfiles } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/url";
import { invitarInput, ROLES, type InvitarInput, type RolUsuario } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function invitarUsuario(
  input: InvitarInput,
): Promise<ActionResult> {
  const actor = await requireRole(["admin"]);

  const parsed = invitarInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { email, nombre, rol } = parsed.data;

  const admin = createAdminClient();
  const base = await siteUrl();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre },
    redirectTo: `${base}/auth/callback?next=/actualizar-clave`,
  });

  if (error) {
    if (/already been registered|already exists/i.test(error.message)) {
      return { ok: false, error: "Ya existe un usuario con ese email." };
    }
    return { ok: false, error: `No se pudo invitar: ${error.message}` };
  }

  // El trigger crea el perfil con rol 'lectura'; lo dejamos con el rol elegido.
  if (data.user) {
    await db
      .insert(perfiles)
      .values({ id: data.user.id, nombre, rol })
      .onConflictDoUpdate({
        target: perfiles.id,
        set: { nombre, rol, activo: true },
      });
  }

  await registrarAuditoria({
    actorId: actor.id,
    accion: "crear",
    entidad: "usuario",
    entidadId: data.user?.id,
    datos: { email, rol },
  });

  revalidatePath("/config/usuarios");
  return { ok: true };
}

export async function cambiarRol(
  id: string,
  rol: RolUsuario,
): Promise<ActionResult> {
  const actor = await requireRole(["admin"]);
  if (!ROLES.includes(rol)) return { ok: false, error: "Rol inválido." };
  if (id === actor.id && rol !== "admin") {
    return { ok: false, error: "No podés quitarte a vos mismo el rol de admin." };
  }

  await db.update(perfiles).set({ rol }).where(eq(perfiles.id, id));
  await registrarAuditoria({
    actorId: actor.id,
    accion: "editar",
    entidad: "usuario",
    entidadId: id,
    datos: { rol },
  });
  revalidatePath("/config/usuarios");
  return { ok: true };
}

export async function toggleUsuarioActivo(
  id: string,
  activo: boolean,
): Promise<ActionResult> {
  const actor = await requireRole(["admin"]);
  if (id === actor.id && !activo) {
    return { ok: false, error: "No podés desactivar tu propio usuario." };
  }

  await db.update(perfiles).set({ activo }).where(eq(perfiles.id, id));
  await registrarAuditoria({
    actorId: actor.id,
    accion: "editar",
    entidad: "usuario",
    entidadId: id,
    datos: { activo },
  });
  revalidatePath("/config/usuarios");
  return { ok: true };
}

export async function reenviarInvitacion(
  email: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const admin = createAdminClient();
  const base = await siteUrl();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${base}/auth/callback?next=/actualizar-clave`,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
