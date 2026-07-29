-- ══════════════════════════════════════════════════════════════════════════════
-- Fix #36: Persistir programas personalizados y sus ediciones en la base de datos
--
-- Hasta ahora, los programas creados con el editor completo (con descripción,
-- presupuesto, imagen, empleados asignados) y las ediciones a los programas
-- globales predefinidos se guardaban SOLO en localStorage del navegador. Esto
-- significaba que: (a) se perdían si se borraba el navegador o se cambiaba de
-- dispositivo, y (b) ningún otro usuario de la empresa los veía nunca.
--
-- Esta migración:
--   1. Agrega las columnas que faltaban en "programs" para soportar todos los
--      campos del editor (descripción, presupuesto, imagen, empleados, etc.)
--   2. Crea "program_overrides" para las ediciones a los programas globales
--      predefinidos (Trabajo en equipo, Liderazgo, etc.), por empresa.
--   3. Corrige las policies de INSERT/UPDATE de "programs", que no validaban
--      company_id (mismo problema que tenía "rewards" antes del fix #4 — un
--      admin podía crear/editar programas de OTRA empresa).
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Columnas nuevas en programs
alter table public.programs add column if not exists description         text;
alter table public.programs add column if not exists tag                 text;
alter table public.programs add column if not exists budget              integer default 0;
alter table public.programs add column if not exists budget_remaining    integer;
alter table public.programs add column if not exists image_url           text;
alter table public.programs add column if not exists target_employee_ids text[];
alter table public.programs add column if not exists custom              boolean default true;
alter table public.programs add column if not exists created_by          uuid;
alter table public.programs add column if not exists pending             boolean default false;

-- 2) Tabla de overrides para los programas globales predefinidos
create table if not exists public.program_overrides (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null references public.companies(id) on delete cascade,
  program_key text not null,
  emoji       text,
  name        text,
  tag         text,
  description text,
  updated_at  timestamptz default now(),
  unique (company_id, program_key)
);

alter table public.program_overrides enable row level security;

create policy "program_overrides_select" on public.program_overrides for select to authenticated
  using (company_id = public.my_company_id() or public.my_role() = 'superadmin');

create policy "program_overrides_insert" on public.program_overrides for insert to authenticated
  with check (
    public.my_role() = 'superadmin'
    or (public.my_role() = 'admin' and company_id = public.my_company_id())
  );

create policy "program_overrides_update" on public.program_overrides for update to authenticated
  using (
    public.my_role() = 'superadmin'
    or (public.my_role() = 'admin' and company_id = public.my_company_id())
  )
  with check (
    public.my_role() = 'superadmin'
    or (public.my_role() = 'admin' and company_id = public.my_company_id())
  );

-- 3) Corregir policies de programs: validar company_id en insert/update
-- Los empleados pueden insertar su propia fila "pendiente de aprobación"
-- (pending=true, active=false) cuando solicitan un programa con presupuesto;
-- solo admin/superadmin pueden insertar programas ya activos.
drop policy if exists "programs_insert" on public.programs;
create policy "programs_insert" on public.programs for insert to authenticated
  with check (
    public.my_role() = 'superadmin'
    or (public.my_role() = 'admin' and company_id = public.my_company_id())
    or (company_id = public.my_company_id() and pending = true and active = false)
  );

drop policy if exists "programs_update" on public.programs;
create policy "programs_update" on public.programs for update to authenticated
  using (
    public.my_role() = 'superadmin'
    or (public.my_role() = 'admin' and company_id = public.my_company_id())
  )
  with check (
    public.my_role() = 'superadmin'
    or (public.my_role() = 'admin' and company_id = public.my_company_id())
  );
