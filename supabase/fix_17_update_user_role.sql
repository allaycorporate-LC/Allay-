-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #17: RPC para cambio de rol por superadmin
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.update_user_role(
  p_target_user_id uuid,
  p_new_role        text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo superadmin puede cambiar roles
  if public.my_role() <> 'superadmin' then
    raise exception 'insufficient_privilege: only superadmin can change roles';
  end if;

  -- Validar que el rol sea válido
  if p_new_role not in ('employee', 'admin', 'superadmin') then
    raise exception 'invalid_role: must be employee, admin, or superadmin';
  end if;

  update public.profiles
    set role = p_new_role
    where id = p_target_user_id;
end;
$$;

-- Solo usuarios autenticados pueden llamarla
revoke all on function public.update_user_role(uuid, text) from public;
grant execute on function public.update_user_role(uuid, text) to authenticated;
