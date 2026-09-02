import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con la service_role key. Bypassa RLS y permite el admin API
 * (crear/invitar usuarios). SOLO servidor — nunca importar desde un componente
 * cliente.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para el admin de usuarios.",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
