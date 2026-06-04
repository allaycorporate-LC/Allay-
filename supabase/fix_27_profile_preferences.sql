-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #27: Persistir preferencias y perfil "Acerca de mí" en Supabase
--
-- Antes estas columnas se guardaban solo en localStorage (por dispositivo).
-- Ahora se almacenan en el perfil del usuario en la base de datos.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists recognition_visibility text not null default 'public',
  add column if not exists bio                    text,
  add column if not exists interests              text,
  add column if not exists work_style             text;
