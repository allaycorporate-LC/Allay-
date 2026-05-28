-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #15: Campos de cumpleaños y aniversario en perfiles
--
-- Agrega soporte para fechas especiales por empleado.
-- birthday:       TEXT formato 'DD/MM'  (solo día y mes, sin año por privacidad)
-- anniversary_date: DATE formato 'YYYY-MM-DD' (fecha de ingreso a la empresa)
-- auto_birthday:  BOOLEAN — si el sistema debe enviar reconocimiento automático
-- auto_anniversary: BOOLEAN — ídem para aniversario
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists birthday          text,           -- 'DD/MM'
  add column if not exists anniversary_date  date,           -- fecha de ingreso
  add column if not exists auto_birthday     boolean default true,
  add column if not exists auto_anniversary  boolean default true;

-- Índices para lookups eficientes al enviar reconocimientos automáticos
create index if not exists profiles_birthday_idx
  on public.profiles(birthday)
  where birthday is not null;

create index if not exists profiles_anniversary_idx
  on public.profiles(anniversary_date)
  where anniversary_date is not null;

-- ── Verificación ──────────────────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
-- where table_name = 'profiles'
-- and column_name in ('birthday','anniversary_date','auto_birthday','auto_anniversary');
