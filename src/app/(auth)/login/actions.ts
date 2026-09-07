"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email("Email inválido."),
  password: z.string().min(1, "Ingresá la contraseña."),
});

export type LoginState = { error: string } | null;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return { error: "Email o contraseña incorrectos." };
  }

  await registrarAuditoria({
    actorId: data.user.id,
    accion: "login",
    entidad: "sesion",
    datos: { email: parsed.data.email },
  });

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await registrarAuditoria({
      actorId: user.id,
      accion: "logout",
      entidad: "sesion",
    });
  }
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
