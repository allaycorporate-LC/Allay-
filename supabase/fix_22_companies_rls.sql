-- Fix #22: RLS y permisos para tabla companies
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
--
-- Permite que superadmins puedan crear, editar y eliminar empresas
-- desde el panel de administrador de Allay.

-- Habilitar RLS
alter table public.companies enable row level security;

-- Todos los usuarios autenticados pueden leer empresas
create policy "companies_select"
  on public.companies for select
  to authenticated
  using (true);

-- Solo superadmin puede insertar
create policy "companies_insert"
  on public.companies for insert
  to authenticated
  with check (
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
  );

-- Solo superadmin puede actualizar
create policy "companies_update"
  on public.companies for update
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
  );

-- Solo superadmin puede eliminar
create policy "companies_delete"
  on public.companies for delete
  to authenticated
  using (
    (select role from public.profiles where id = auth.uid()) = 'superadmin'
  );
