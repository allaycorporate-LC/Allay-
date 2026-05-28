-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #16: Configuración de reconocimientos automáticos por empresa
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.auto_recognition_settings (
  id                   uuid        primary key default gen_random_uuid(),
  company_id           text        not null unique,
  enabled              boolean     not null default true,
  -- Cumpleaños
  birthday_enabled     boolean     not null default true,
  birthday_message     text        not null default '¡Feliz cumpleaños, {nombre}! Hoy el equipo entero te celebra. Gracias por ser parte de esto.',
  birthday_program     text,
  birthday_points      integer     not null default 0,
  -- Aniversario
  anniversary_enabled  boolean     not null default true,
  anniversary_message  text        not null default '¡{nombre}, hoy se cumplen {años} año(s) desde que te sumaste al equipo! Gracias por todo lo que trajiste.',
  anniversary_program  text,
  anniversary_points   integer     not null default 0,
  -- Control
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.auto_recognition_settings enable row level security;

-- Admins pueden leer y escribir los settings de su empresa
create policy "ars_select" on public.auto_recognition_settings for select to authenticated
  using (public.my_role() = 'superadmin' or company_id = public.my_company_id());

create policy "ars_upsert" on public.auto_recognition_settings for all to authenticated
  using (public.my_role() in ('admin','superadmin') or company_id = public.my_company_id())
  with check (public.my_role() in ('admin','superadmin') or company_id = public.my_company_id());
