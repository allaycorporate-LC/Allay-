-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #29: Función dedicada para guardar preferencias de reconocimiento
--
-- El update general de profiles puede ser rechazado por el trigger de
-- anti-escalación cuando un employee manda campos sensibles (role, points, etc.)
-- junto con los campos de preferencias.
--
-- Esta función security definer sólo toca los 3 campos de preferencias y
-- aplica WHERE id = auth.uid(), por lo que es segura y sin riesgo de escalada.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.update_user_preferences(
  p_recognition_visibility text    default 'public',
  p_auto_birthday          boolean default true,
  p_auto_anniversary       boolean default true
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    recognition_visibility = p_recognition_visibility,
    auto_birthday          = p_auto_birthday,
    auto_anniversary       = p_auto_anniversary
  where id = auth.uid();
end;
$$;

grant execute on function public.update_user_preferences(text, boolean, boolean) to authenticated;
