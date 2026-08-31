import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/** Cliente Supabase para componentes del navegador ("use client"). */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
