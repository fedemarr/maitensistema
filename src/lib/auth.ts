import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { perfiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type Rol = "admin" | "ventas" | "lectura";

export type SessionUser = {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
};

/**
 * Usuario de la sesión + su perfil (rol). `cache()` lo deduplica dentro
 * del mismo request. Devuelve null si no hay sesión o el perfil está inactivo.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const perfil = await db.query.perfiles.findFirst({
    where: eq(perfiles.id, user.id),
  });
  if (!perfil || !perfil.activo) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    nombre: perfil.nombre,
    rol: perfil.rol,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Guard para Server Actions. La conexión de Drizzle usa el rol `postgres`
 * y NO pasa por RLS, así que la autorización de escritura se hace acá.
 */
export async function requireRole(roles: Rol[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.rol)) {
    throw new Error("No tenés permiso para realizar esta acción.");
  }
  return user;
}

export const puedeEscribir = (rol: Rol) => rol === "admin" || rol === "ventas";
