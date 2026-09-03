-- ─────────────────────────────────────────────────────────────
-- RESET del esquema public para Fase 4.
-- Borra TODO lo de `public` (y el tracking de drizzle) y restaura los
-- permisos por defecto de Supabase. NO toca `auth` (los usuarios quedan).
-- Correr una sola vez antes de `pnpm db:migrate` de Fase 4.
-- ─────────────────────────────────────────────────────────────

drop schema if exists drizzle cascade;
drop schema public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
