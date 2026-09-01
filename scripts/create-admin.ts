/**
 * Crea (o actualiza) un usuario en Supabase Auth y lo deja con rol 'admin'.
 *   pnpm create-admin -- <email> <password> ["Nombre"]
 * Usa la service_role key (solo servidor).
 */
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const [email, password, nombre] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !password) {
  throw new Error('Uso: pnpm create-admin -- <email> <password> ["Nombre"]');
}
if (!url || !serviceKey || !process.env.DATABASE_URL) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL.",
  );
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

async function main() {
  let userId: string | undefined;

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombre ?? email },
  });

  if (created.error) {
    if (!/registered|already/i.test(created.error.message)) throw created.error;
    // Ya existe: lo buscamos.
    const list = await admin.auth.admin.listUsers();
    if (list.error) throw list.error;
    userId = list.data.users.find((u) => u.email === email)?.id;
    console.log("El usuario ya existía, actualizo su rol.");
  } else {
    userId = created.data.user?.id;
    console.log("Usuario creado.");
  }

  if (!userId) throw new Error("No pude obtener el id del usuario.");

  // El trigger de setup.sql crea el perfil; por las dudas, upsert + rol admin.
  await sql`
    insert into public.perfiles (id, nombre, rol, activo)
    values (${userId}, ${nombre ?? email}, 'admin', true)
    on conflict (id) do update set rol = 'admin', activo = true
  `;

  console.log(`Listo: ${email} es admin (${userId}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
