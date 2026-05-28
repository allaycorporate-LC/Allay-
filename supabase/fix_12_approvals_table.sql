-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #12: Tabla de aprobaciones
--
-- Mueve las aprobaciones de programa de localStorage a la base de datos.
-- Esto permite que los admins vean las solicitudes desde cualquier dispositivo.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.program_budget_requests (
  id            text        primary key,          -- 'apr-{timestamp}'
  company_id    text        not null,
  requested_by  uuid        references public.profiles(id) on delete set null,
  status        text        not null default 'pending' check (status in ('pending','approved','rejected')),
  data          jsonb       not null default '{}',  -- full request payload
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  processed_by  uuid        references public.profiles(id) on delete set null
);

-- Índices
create index if not exists pbr_company_status_idx
  on public.program_budget_requests(company_id, status);

create index if not exists pbr_created_idx
  on public.program_budget_requests(created_at desc);

-- RLS
alter table public.program_budget_requests enable row level security;

-- Empleados pueden insertar solicitudes de su empresa
create policy "pbr_insert"
  on public.program_budget_requests for insert
  to authenticated
  with check (company_id = public.my_company_id());

-- Admins/superadmins pueden ver y actualizar las solicitudes de su empresa
create policy "pbr_select"
  on public.program_budget_requests for select
  to authenticated
  using (
    public.my_role() = 'superadmin'
    or (company_id = public.my_company_id() and public.my_role() in ('admin','superadmin'))
  );

create policy "pbr_update"
  on public.program_budget_requests for update
  to authenticated
  using (
    public.my_role() = 'superadmin'
    or (company_id = public.my_company_id() and public.my_role() in ('admin','superadmin'))
  )
  with check (
    public.my_role() = 'superadmin'
    or (company_id = public.my_company_id() and public.my_role() in ('admin','superadmin'))
  );
