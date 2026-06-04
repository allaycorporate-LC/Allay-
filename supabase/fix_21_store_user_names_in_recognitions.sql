-- Fix #21: Guardar nombre del usuario en cada reconocimiento
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
--
-- Propósito: cuando se elimina un usuario, su nombre queda guardado
-- en from_user_name / to_user_name para que el historial sea legible.
-- Requiere fix_20 (ON DELETE SET NULL) ejecutado previamente.

-- ── Agregar columnas de snapshot ────────────────────────────────────────────
alter table public.recognitions
  add column if not exists from_user_name text,
  add column if not exists to_user_name   text;

-- ── Backfill: poblar con nombres de usuarios que aún existen ────────────────
update public.recognitions r
set from_user_name = p.name
from public.profiles p
where r.from_user_id = p.id
  and r.from_user_name is null;

update public.recognitions r
set to_user_name = p.name
from public.profiles p
where r.to_user_id = p.id
  and r.to_user_name is null;
