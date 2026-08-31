-- ─────────────────────────────────────────────────────────────
-- Setup Supabase para Maitén — Sistema de Gestión
-- Ejecutar en: SQL Editor del proyecto zcowjjrsjiuzrlphvzyx
-- ─────────────────────────────────────────────────────────────
--
-- Modelo de datos: una única tabla con UNA fila (id='main')
-- que guarda TODO el estado de la app como JSONB.
-- El HTML la lee/escribe vía la publishable key.
--
-- Si ya existe la tabla y querés empezar de cero, descomentá:
-- drop table if exists public.app_state;

create table if not exists public.app_state (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Row-Level Security habilitada + policy permisiva
-- (el sistema tiene 1-3 usuarios, sin Supabase Auth —
--  la única "seguridad" es el login de la app sobre el JSON).
alter table public.app_state enable row level security;

drop policy if exists "app_state allow all" on public.app_state;

create policy "app_state allow all" on public.app_state
  for all
  using (true)
  with check (true);

-- ─────────────────────────────────────────────────────────────
-- Verificación — correr después para confirmar
-- ─────────────────────────────────────────────────────────────
-- select * from public.app_state;
-- (al inicio está vacía; se poblará la primera vez que guardes algo desde la app)
