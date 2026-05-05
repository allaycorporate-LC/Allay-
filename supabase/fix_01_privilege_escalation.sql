-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #1: Escalada de privilegios en profiles_update
--
-- Problema: la política original tenía with check (true), lo que permitía
-- a cualquier usuario autenticado cambiar su propio rol, company_id y puntos
-- haciendo una llamada directa al API de Supabase desde el browser.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Paso 1: Funciones helper (si no existen ya) ───────────────────────────────
-- Estas funciones corren como security definer para poder leer profiles
-- incluso cuando RLS lo bloquearía (evitan recursión en las policies).

create or replace function public.my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_company_id()
returns text
language sql stable security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;


-- ── Paso 2: Reemplazar la política de update ──────────────────────────────────

drop policy if exists "profiles_update" on public.profiles;

create policy "profiles_update"
  on public.profiles for update
  to authenticated
  using (
    -- Quién puede apuntar a un row para actualizar:
    id = auth.uid()                             -- propio perfil
    or public.my_role() in ('admin', 'superadmin')   -- o si es admin/superadmin
  )
  with check (
    -- Superadmin: sin restricciones
    public.my_role() = 'superadmin'

    -- Admin: solo dentro de su empresa, nunca puede asignar rol superadmin
    or (
      public.my_role() = 'admin'
      and role <> 'superadmin'
      and company_id = public.my_company_id()
    )

    -- Employee: solo su propio perfil
    -- (el trigger del paso 3 previene cambios en campos sensibles)
    or (
      id = auth.uid()
      and public.my_role() = 'employee'
    )
  );


-- ── Paso 3: Trigger BEFORE UPDATE — protección de columnas sensibles ──────────
--
-- RLS no puede restringir qué COLUMNAS se modifican, solo qué FILAS.
-- Este trigger, que corre ANTES del UPDATE, fuerza los valores de campos
-- sensibles de vuelta a OLD cuando el caller es un employee.
--
-- Por qué se chequea current_user:
--   - Llamadas del browser (PostgREST)     → current_user = 'authenticated'
--   - Funciones security definer internas  → current_user = 'postgres'
-- Las funciones como send_recognition necesitan modificar points_to_give
-- legítimamente, por eso las dejamos pasar.

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- Llamadas desde funciones security definer internas (send_recognition, etc.)
  -- no deben ser bloqueadas por este trigger.
  if current_user <> 'authenticated' then
    return NEW;
  end if;

  v_role := public.my_role();

  -- Employee actualizando su propio perfil: proteger campos sensibles
  if v_role = 'employee' then
    NEW.role             := OLD.role;
    NEW.company_id       := OLD.company_id;
    NEW.points_to_give   := OLD.points_to_give;
    NEW.points_to_redeem := OLD.points_to_redeem;
  end if;

  -- Admin intentando auto-promoverse a superadmin: bloquear explícitamente
  if v_role = 'admin' and NEW.id = auth.uid() and NEW.role = 'superadmin' then
    raise exception 'Forbidden: no podés asignarte el rol superadmin'
      using errcode = 'insufficient_privilege';
  end if;

  return NEW;
end;
$$;

drop trigger if exists profiles_prevent_escalation on public.profiles;

create trigger profiles_prevent_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_profile_privilege_escalation();


-- ── Verificación ──────────────────────────────────────────────────────────────
-- Después de ejecutar, podés verificar con:
--
--   select policyname, cmd, qual, with_check
--   from pg_policies
--   where tablename = 'profiles';
--
--   select trigger_name, event_manipulation, action_timing
--   from information_schema.triggers
--   where event_object_table = 'profiles';
