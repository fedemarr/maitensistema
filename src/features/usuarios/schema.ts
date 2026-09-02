import { z } from "zod";

export const ROLES = ["admin", "ventas", "lectura"] as const;
export type RolUsuario = (typeof ROLES)[number];

export const ROL_LABEL: Record<RolUsuario, string> = {
  admin: "Administrador",
  ventas: "Ventas",
  lectura: "Solo lectura",
};

export const ROL_DESC: Record<RolUsuario, string> = {
  admin: "Todo, incluida la gestión de usuarios y eliminaciones.",
  ventas: "Carga y edita movimientos, productos, clientes. No borra ni gestiona usuarios.",
  lectura: "Solo mira. No puede modificar nada.",
};

export const invitarInput = z.object({
  email: z.email("Email inválido."),
  nombre: z.string().trim().min(1, "Poné un nombre.").max(120),
  rol: z.enum(ROLES),
});
export type InvitarInput = z.infer<typeof invitarInput>;

export const nuevaClaveInput = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres."),
    repetir: z.string(),
  })
  .refine((d) => d.password === d.repetir, {
    message: "Las contraseñas no coinciden.",
    path: ["repetir"],
  });
