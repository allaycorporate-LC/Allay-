-- Fix #25: Clean, reliable update_employee_dates function
-- Replaces any previous version. SECURITY DEFINER bypasses RLS.

create or replace function public.update_employee_dates(
  p_employee_id    uuid,
  p_birthday       text,
  p_anniversary_date text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set
    birthday         = p_birthday,
    anniversary_date = case
      when p_anniversary_date ~ '^\d{4}-\d{2}-\d{2}$'
      then p_anniversary_date::date
      else null
    end,
    auto_birthday    = true,
    auto_anniversary = true
  where id = p_employee_id;
end;
$$;
