"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/url";

const schema = z.object({ email: z.email("Email inválido.") });

export type RecuperarState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; error: string };

export async function solicitarReset(
  _prev: RecuperarState,
  formData: FormData,
): Promise<RecuperarState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const base = await siteUrl();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${base}/auth/callback?next=/actualizar-clave`,
  });

  // Siempre "sent": no revelamos si el email existe.
  return { status: "sent" };
}
