-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #5 (parte SQL): Tabla para tokens de verificación del /link de Slack
--
-- El flujo nuevo:
--   1. Usuario ejecuta /allay link email@empresa.com en Slack
--   2. Se genera un token aleatorio y se guarda acá con TTL de 15 min
--   3. Se envía email al address con un link de confirmación
--   4. Usuario hace click → Edge Function slack-verify valida el token
--      y actualiza slack_user_id en profiles
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.slack_link_tokens (
  id            uuid        primary key default gen_random_uuid(),
  token         text        not null unique default encode(gen_random_bytes(32), 'hex'),
  email         text        not null,
  slack_user_id text        not null,
  expires_at    timestamptz not null default (now() + interval '15 minutes'),
  used          boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- Sin policies = solo service_role puede leer/escribir (RLS bloqueado para todos)
alter table public.slack_link_tokens enable row level security;

-- Índice para búsquedas rápidas por token
create index if not exists slack_link_tokens_token_idx
  on public.slack_link_tokens (token)
  where not used;

-- Limpieza automática de tokens expirados (requiere pg_cron)
-- Activar pg_cron en: Dashboard → Database → Extensions → pg_cron
-- Luego ejecutar:
--
-- select cron.schedule(
--   'allay-cleanup-slack-tokens',
--   '0 * * * *',   -- cada hora
--   $$ delete from public.slack_link_tokens where expires_at < now() $$
-- );
