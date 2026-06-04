-- Fix #23: Tabla csv_requests para el flujo de aprobación de CSV
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
--
-- Los administradores de empresa envían solicitudes de carga CSV
-- que el superadmin revisa y aprueba o rechaza desde la plataforma.

create table if not exists public.csv_requests (
  id               uuid        primary key default gen_random_uuid(),
  requested_by     uuid        references public.profiles(id) on delete set null,
  company_id       text        not null,
  file_name        text,
  csv_content      text        not null,
  row_count        int         not null default 0,
  status           text        not null default 'pending'
                               check (status in ('pending', 'approved', 'rejected')),
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid        references public.profiles(id) on delete set null,
  rejection_reason text
);

alter table public.csv_requests enable row level security;

-- Superadmin puede ver y gestionar todas las solicitudes
create policy "csv_requests_superadmin"
  on public.csv_requests
  for all to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
  )
  with check (
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
  );

-- Admins pueden ver sus propias solicitudes
create policy "csv_requests_admin_select"
  on public.csv_requests
  for select to authenticated
  using ( requested_by = auth.uid() );

-- Admins pueden crear solicitudes para su empresa
create policy "csv_requests_admin_insert"
  on public.csv_requests
  for insert to authenticated
  with check (
    (select role from public.profiles where id = auth.uid()) in ('admin', 'superadmin')
    and requested_by = auth.uid()
  );
