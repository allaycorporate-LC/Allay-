-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #30: Función para descontar puntos del admin al aprobar un programa
--
-- Cuando un admin aprueba una solicitud de programa con presupuesto de puntos,
-- se descuentan esos puntos de su propia billetera (points_to_give).
-- Siempre opera sobre auth.uid() — no acepta un ID externo.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Eliminar versión anterior si existe (tenía parámetro p_admin_id)
drop function if exists public.deduct_admin_points(uuid, integer);

create or replace function public.deduct_admin_points(
  p_amount integer
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_current integer;
begin
  select points_to_give into v_current
  from public.profiles
  where id = auth.uid();

  if v_current is null or v_current < p_amount then
    raise exception 'Puntos insuficientes (disponible: %, requerido: %)', coalesce(v_current, 0), p_amount;
  end if;

  update public.profiles
  set points_to_give = points_to_give - p_amount
  where id = auth.uid();
end;
$$;

grant execute on function public.deduct_admin_points(integer) to authenticated;
