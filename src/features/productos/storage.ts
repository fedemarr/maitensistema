import "server-only";

import { createClient } from "@/lib/supabase/server";

export const BUCKET_PRODUCTOS = "productos";

/**
 * URL firmada (1h) para mostrar la foto de un producto desde un bucket privado.
 * Devuelve null si no hay foto o falla la firma.
 */
export async function getFotoUrl(
  fotoPath: string | null | undefined,
): Promise<string | null> {
  if (!fotoPath) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_PRODUCTOS)
    .createSignedUrl(fotoPath, 60 * 60);
  if (error) {
    console.error("createSignedUrl:", error.message);
    return null;
  }
  return data.signedUrl;
}
