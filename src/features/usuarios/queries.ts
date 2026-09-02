import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { RolUsuario } from "./schema";

export type UsuarioListItem = {
  id: string;
  nombre: string;
  email: string | null;
  rol: RolUsuario;
  activo: boolean;
  ultimoAcceso: string | null;
};

/** Perfiles + email y último acceso desde auth.users (lectura vía service DB). */
export async function listUsuarios(): Promise<UsuarioListItem[]> {
  const rows = (await db.execute(sql`
    select p.id, p.nombre, p.rol, p.activo,
           u.email, u.last_sign_in_at
    from public.perfiles p
    left join auth.users u on u.id = p.id
    order by p.nombre
  `)) as unknown as Array<{
    id: string;
    nombre: string;
    email: string | null;
    rol: RolUsuario;
    activo: boolean;
    last_sign_in_at: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    email: r.email,
    rol: r.rol,
    activo: r.activo,
    ultimoAcceso: r.last_sign_in_at,
  }));
}
