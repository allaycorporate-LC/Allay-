-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #28: Cambiar cron de reconocimientos automáticos a cada 15 minutos
--
-- Antes: corría una vez al día a las 12:00 UTC.
-- Ahora: corre cada 15 minutos y la edge function filtra por send_time de
--        cada empresa, procesando sólo las que coincidan con la hora UTC actual.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Actualizar el schedule del job existente (jobname = 'allay-auto-recognitions')
select cron.alter_job(
  job_id   := (select jobid from cron.job where jobname = 'allay-auto-recognitions'),
  schedule := '*/15 * * * *'
);
