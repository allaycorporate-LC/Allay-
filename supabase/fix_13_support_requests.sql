-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #13: Tabla de solicitudes de soporte
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.support_requests (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references public.profiles(id) on delete set null,
  company_id  text,
  name        text,
  email       text,
  subject     text,
  message     text        not null,
  status      text        not null default 'open' check (status in ('open','resolved')),
  created_at  timestamptz not null default now()
);

alter table public.support_requests enable row level security;

-- Cualquier usuario autenticado puede insertar su propia solicitud
create policy "support_insert"
  on public.support_requests for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- Solo superadmin puede leer todas
create policy "support_select"
  on public.support_requests for select
  to authenticated
  using (public.my_role() = 'superadmin');

create index if not exists support_created_idx
  on public.support_requests(created_at desc);
