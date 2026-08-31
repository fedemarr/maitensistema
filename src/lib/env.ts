import { z } from "zod";

/**
 * Variables de entorno públicas (se inyectan en el bundle del cliente).
 * Se validan al arrancar: si falta alguna, la app no levanta y te dice cuál.
 * Las variables SOLO-servidor (DATABASE_URL, *_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY)
 * se leen directo de process.env en el código de servidor, nunca acá.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((i) => ` - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Faltan variables de entorno.\nCopiá .env.example a .env.local y completá los valores de Supabase.\n${detalle}`,
  );
}

export const env = parsed.data;
