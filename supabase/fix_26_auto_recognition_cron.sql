-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #26: Cron job para reconocimientos automáticos
--
-- PASO 1: Ir a Supabase Dashboard → Project Settings → API
--         Copiar el valor de "service_role" key (la secreta)
--         Reemplazar YOUR_SERVICE_ROLE_KEY abajo
--
-- PASO 2: Ejecutar este SQL en Supabase → SQL Editor
--
-- Corre todos los días a las 12:00 UTC = 09:00 ART
-- ─────────────────────────────────────────────────────────────────────────────

-- Habilitar extensiones
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Eliminar job anterior si ya existe
select cron.unschedule('allay-auto-recognitions');

-- Crear cron job: diariamente a las 12:00 UTC (09:00 ART)
select cron.schedule(
  'allay-auto-recognitions',
  '0 12 * * *',
  $$
    select net.http_post(
      url     := 'https://smuwnjpmpmwfuysrxkaa.supabase.co/functions/v1/send-auto-recognitions',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

-- Confirmar que quedó creado
select jobid, jobname, schedule, active
from cron.job
where jobname = 'allay-auto-recognitions';
