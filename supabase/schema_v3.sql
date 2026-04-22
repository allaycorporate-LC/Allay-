-- ─────────────────────────────────────────────────────────────────────────────
-- ALLAY — Schema v3: Programs, Analytics, Slack, Monthly Budget Reset
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Presupuesto mensual configurable por empresa
alter table public.companies add column if not exists monthly_allowance integer default 100;

-- 2. slack_user_id en profiles (para vincular cuentas)
alter table public.profiles add column if not exists slack_user_id text;

-- 3. PROGRAMS — valores corporativos configurables por empresa
create table if not exists public.programs (
  id         uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  name       text not null,
  emoji      text default '⭐',
  active     boolean default true,
  created_at timestamptz default now()
);

alter table public.programs enable row level security;

create policy "programs_select" on public.programs for select to authenticated
  using (company_id = public.my_company_id() or public.my_role() = 'superadmin');

create policy "programs_insert" on public.programs for insert to authenticated
  with check (public.my_role() in ('admin', 'superadmin'));

create policy "programs_update" on public.programs for update to authenticated
  using (public.my_role() in ('admin', 'superadmin'));

create policy "programs_delete" on public.programs for delete to authenticated
  using (public.my_role() in ('admin', 'superadmin'));

-- Seed: programas por defecto para cada empresa
insert into public.programs (company_id, name, emoji) values
  ('comp-1', 'Trabajo en equipo', '🏆'),
  ('comp-1', 'Innovación',        '💡'),
  ('comp-1', 'Colaboración',      '🤝'),
  ('comp-1', 'Excelencia',        '⭐'),
  ('comp-1', 'Liderazgo',         '🎯'),
  ('comp-1', 'Cultura',           '💜'),
  ('comp-2', 'Trabajo en equipo', '🏆'),
  ('comp-2', 'Innovación',        '💡'),
  ('comp-2', 'Colaboración',      '🤝'),
  ('comp-2', 'Excelencia',        '⭐'),
  ('comp-2', 'Liderazgo',         '🎯'),
  ('comp-2', 'Cultura',           '💜'),
  ('comp-3', 'Trabajo en equipo', '🏆'),
  ('comp-3', 'Innovación',        '💡'),
  ('comp-3', 'Colaboración',      '🤝'),
  ('comp-3', 'Excelencia',        '⭐')
on conflict do nothing;

-- ─── ANALYTICS RPCs ───────────────────────────────────────────────────────────

-- Resumen total
create or replace function public.analytics_summary()
returns table (
  total_recognitions bigint,
  total_points       bigint,
  active_senders     bigint,
  this_month         bigint
)
language sql security definer as $$
  select
    count(*)                                                            as total_recognitions,
    coalesce(sum(points), 0)                                            as total_points,
    count(distinct from_user_id)                                        as active_senders,
    count(*) filter (where created_at >= date_trunc('month', now()))    as this_month
  from public.recognitions
  where company_id = public.my_company_id()
     or public.my_role() = 'superadmin';
$$;

-- Top reconocidos
create or replace function public.analytics_top_recognized(p_limit int default 10)
returns table (
  user_id           uuid,
  name              text,
  department        text,
  total_points      bigint,
  recognition_count bigint
)
language sql security definer as $$
  select
    p.id,
    p.name,
    p.department,
    coalesce(sum(r.points), 0) as total_points,
    count(r.id)                as recognition_count
  from public.profiles p
  join public.recognitions r on r.to_user_id = p.id
  where (r.company_id = public.my_company_id() or public.my_role() = 'superadmin')
  group by p.id, p.name, p.department
  order by total_points desc
  limit p_limit;
$$;

-- Reconocimientos por área
create or replace function public.analytics_by_department()
returns table (
  department        text,
  total_points      bigint,
  recognition_count bigint
)
language sql security definer as $$
  select
    p.department,
    coalesce(sum(r.points), 0) as total_points,
    count(r.id)                as recognition_count
  from public.recognitions r
  join public.profiles p on p.id = r.to_user_id
  where (r.company_id = public.my_company_id() or public.my_role() = 'superadmin')
  group by p.department
  order by recognition_count desc;
$$;

-- Engagement por mes (últimos N meses)
create or replace function public.analytics_by_month(p_months int default 6)
returns table (
  month             text,
  recognition_count bigint,
  total_points      bigint,
  unique_senders    bigint
)
language sql security definer as $$
  select
    to_char(date_trunc('month', r.created_at), 'Mon YYYY') as month,
    count(r.id)                                             as recognition_count,
    coalesce(sum(r.points), 0)                              as total_points,
    count(distinct r.from_user_id)                          as unique_senders
  from public.recognitions r
  where (r.company_id = public.my_company_id() or public.my_role() = 'superadmin')
    and r.created_at >= now() - (p_months || ' months')::interval
  group by date_trunc('month', r.created_at)
  order by date_trunc('month', r.created_at);
$$;

-- ─── send_recognition_as — para uso del Slack webhook (service role) ─────────
-- No usa auth.uid(); acepta from_user_id explícito.
create or replace function public.send_recognition_as(
  p_from_user_id uuid,
  p_to_user_id   uuid,
  p_points       integer,
  p_program      text,
  p_message      text,
  p_company_id   text
) returns uuid
language plpgsql security definer as $$
declare
  v_id          uuid;
  v_from_points integer;
begin
  select points_to_give into v_from_points
    from public.profiles where id = p_from_user_id for update;

  if v_from_points < p_points then
    raise exception 'insufficient_points';
  end if;

  update public.profiles set points_to_give   = points_to_give   - p_points where id = p_from_user_id;
  update public.profiles set points_to_redeem = points_to_redeem + p_points where id = p_to_user_id;

  insert into public.recognitions (from_user_id, to_user_id, points, program, message, company_id)
    values (p_from_user_id, p_to_user_id, p_points, p_program, p_message, p_company_id)
    returning id into v_id;

  insert into public.notifications (user_id, type, data)
    values (p_to_user_id, 'recognition', jsonb_build_object(
      'recognition_id', v_id,
      'from_user_id',   p_from_user_id,
      'points',         p_points,
      'program',        p_program,
      'message',        p_message
    ));

  return v_id;
end;
$$;

-- ─── RESET MENSUAL DE PUNTOS via pg_cron ─────────────────────────────────────
-- Requiere la extensión pg_cron habilitada en Supabase.
-- Activar en: Dashboard → Database → Extensions → pg_cron
-- Luego ejecutar estas líneas por separado:
--
-- select cron.schedule(
--   'allay-reset-monthly-points',
--   '0 0 1 * *',
--   $$
--     update public.profiles p
--     set points_to_give = c.monthly_allowance
--     from public.companies c
--     where c.id = p.company_id;
--   $$
-- );
