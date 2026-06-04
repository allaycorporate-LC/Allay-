-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #24: Incluir birthday y anniversary_date en handle_new_user
--
-- El trigger original no copiaba estos campos desde user_metadata al perfil.
-- Ahora los usuarios creados via CSV tendrán sus fechas automáticamente.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, email, department, company_id, role,
    points_to_give, points_to_redeem, password_changed,
    birthday, anniversary_date, auto_birthday, auto_anniversary
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',         split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'department',   'General'),
    coalesce(new.raw_user_meta_data->>'company_id',   'comp-1'),
    coalesce(new.raw_user_meta_data->>'role',         'employee'),
    coalesce((new.raw_user_meta_data->>'points_to_give')::integer,   100),
    coalesce((new.raw_user_meta_data->>'points_to_redeem')::integer, 0),
    false,
    new.raw_user_meta_data->>'birthday',
    case
      when new.raw_user_meta_data->>'anniversary_date' ~ '^\d{4}-\d{2}-\d{2}$'
      then (new.raw_user_meta_data->>'anniversary_date')::date
      else null
    end,
    coalesce((new.raw_user_meta_data->>'auto_birthday')::boolean,    true),
    coalesce((new.raw_user_meta_data->>'auto_anniversary')::boolean, true)
  );
  return new;
end;
$$;
