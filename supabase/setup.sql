-- ─────────────────────────────────────────────────────────────
-- Setup Supabase para Maitén — correr en el SQL Editor
-- DESPUÉS de aplicar las migraciones de Drizzle (pnpm db:migrate).
--
-- Hace 3 cosas:
--   1. Vincula la tabla `perfiles` con `auth.users` (FK + trigger de alta).
--   2. Activa Row Level Security en todas las tablas de negocio.
--   3. Define políticas: cualquier usuario autenticado lee; escribe
--      según su rol en `perfiles`.
-- ─────────────────────────────────────────────────────────────

-- 1. perfiles <-> auth.users ----------------------------------------------------

alter table public.perfiles
  drop constraint if exists perfiles_id_fkey,
  add constraint perfiles_id_fkey
    foreign key (id) references auth.users (id) on delete cascade;

-- Al crearse un usuario en Auth, se crea su fila en perfiles (rol 'lectura').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email), 'lectura')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de rol -------------------------------------------------------------

create or replace function public.rol_actual()
returns text
language sql
stable
security definer set search_path = ''
as $$
  select rol::text from public.perfiles where id = auth.uid();
$$;

create or replace function public.puede_escribir()
returns boolean
language sql
stable
as $$
  select public.rol_actual() in ('admin', 'ventas');
$$;

-- 2 + 3. RLS + políticas ---------------------------------------------------------

do $$
declare
  t text;
  tablas text[] := array[
    'perfiles', 'rubros', 'productos', 'variantes', 'clientes',
    'proveedores', 'movimientos', 'movimiento_items', 'auditoria'
  ];
begin
  foreach t in array tablas loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "lee autenticado" on public.%I;', t);
    execute format(
      'create policy "lee autenticado" on public.%I for select to authenticated using (true);',
      t
    );

    execute format('drop policy if exists "escribe segun rol" on public.%I;', t);
    execute format(
      'create policy "escribe segun rol" on public.%I for all to authenticated using (public.puede_escribir()) with check (public.puede_escribir());',
      t
    );
  end loop;
end $$;

-- Cada quien puede leer y editar su propio perfil; solo admin cambia roles ajenos.
drop policy if exists "escribe segun rol" on public.perfiles;
drop policy if exists "perfil propio" on public.perfiles;
create policy "perfil propio" on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "admin gestiona perfiles" on public.perfiles;
create policy "admin gestiona perfiles" on public.perfiles
  for all to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Después de correr esto:
--   1. Authentication → Users → Add user  (creá tu usuario admin).
--   2. Volvé acá y corré:
--        update public.perfiles set rol = 'admin'
--        where id = (select id from auth.users where email = 'TU_EMAIL');
--   3. Storage → New bucket → "productos" (privado).
-- ─────────────────────────────────────────────────────────────
