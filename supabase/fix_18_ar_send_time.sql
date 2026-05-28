-- Fix #18: Agregar horario de envío a reconocimientos automáticos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query

alter table public.auto_recognition_settings
  add column if not exists send_time text not null default '09:00';
