-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #11: Reconocimientos privados
--
-- Agrega soporte para reconocimientos privados:
--   - Campo is_private en recognitions
--   - RLS actualizada: empleados solo ven privados donde son emisor o receptor
--   - Admins/superadmins ven todos (incluyendo para analytics)
--   - send_recognition actualizado para aceptar p_is_private
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Paso 1: Agregar columna ───────────────────────────────────────────────────
alter table public.recognitions
  add column if not exists is_private boolean not null default false;


-- ── Paso 2: Actualizar política SELECT ────────────────────────────────────────
drop policy if exists "recognitions_select" on public.recognitions;

create policy "recognitions_select"
  on public.recognitions for select
  to authenticated
  using (
    -- Superadmin ve todo
    public.my_role() = 'superadmin'
    -- Admin ve todo de su empresa (incluye privados para moderar y reportes)
    or (company_id = public.my_company_id() and public.my_role() = 'admin')
    -- Empleado: reconocimientos públicos de su empresa
    --           + sus propios reconocimientos privados (emisor o receptor)
    or (
      company_id = public.my_company_id()
      and (
        not is_private
        or from_user_id = auth.uid()
        or to_user_id   = auth.uid()
      )
    )
  );


-- ── Paso 3: Actualizar función send_recognition ───────────────────────────────
create or replace function public.send_recognition(
  p_to_user_id uuid,
  p_points     integer,
  p_program    text,
  p_message    text,
  p_company_id text,
  p_is_private boolean default false
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id           uuid;
  v_from_user_id uuid;
  v_from_points  integer;
begin
  v_from_user_id := auth.uid();

  select points_to_give into v_from_points
    from public.profiles
    where id = v_from_user_id
    for update;

  if v_from_points < p_points then
    raise exception 'insufficient_points';
  end if;

  update public.profiles
    set points_to_give   = points_to_give   - p_points
    where id = v_from_user_id;

  update public.profiles
    set points_to_redeem = points_to_redeem + p_points
    where id = p_to_user_id;

  insert into public.recognitions
    (from_user_id, to_user_id, points, program, message, company_id, is_private)
    values
    (v_from_user_id, p_to_user_id, p_points, p_program, p_message, p_company_id, p_is_private)
    returning id into v_id;

  insert into public.notifications (user_id, type, data)
    values (p_to_user_id, 'recognition', jsonb_build_object(
      'recognition_id', v_id,
      'from_user_id',   v_from_user_id,
      'points',         p_points,
      'program',        p_program,
      'message',        p_message,
      'is_private',     p_is_private
    ));

  return v_id;
end;
$$;


-- ── Verificación ──────────────────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
-- where table_name='recognitions' and column_name='is_private';
