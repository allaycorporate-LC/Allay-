-- Fix #20: Preserve recognition history after user deletion
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
--
-- Problema: recognitions.from_user_id y to_user_id tienen ON DELETE CASCADE,
-- por lo que al eliminar un usuario se borran todos sus reconocimientos.
-- Solución: cambiar a ON DELETE SET NULL para que los reconocimientos
-- queden con from_user_id / to_user_id = NULL y se muestren como
-- "Usuario eliminado" en el feed y en analytics.

-- ── Paso 1: eliminar constraints actuales ───────────────────────────────────
alter table public.recognitions
  drop constraint if exists recognitions_from_user_id_fkey;

alter table public.recognitions
  drop constraint if exists recognitions_to_user_id_fkey;

-- ── Paso 2: hacer las columnas nullable (requerido para SET NULL) ────────────
alter table public.recognitions
  alter column from_user_id drop not null;

alter table public.recognitions
  alter column to_user_id drop not null;

-- ── Paso 3: re-agregar con ON DELETE SET NULL ────────────────────────────────
alter table public.recognitions
  add constraint recognitions_from_user_id_fkey
  foreign key (from_user_id)
  references public.profiles(id)
  on delete set null;

alter table public.recognitions
  add constraint recognitions_to_user_id_fkey
  foreign key (to_user_id)
  references public.profiles(id)
  on delete set null;
