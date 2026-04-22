-- ─────────────────────────────────────────────────────────────────────────────
-- ALLAY — Schema v2: Recognitions, Reactions, Comments, Rewards, Notifications
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. RECOGNITIONS
create table if not exists public.recognitions (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id   uuid not null references public.profiles(id) on delete cascade,
  points       integer not null check (points >= 0),
  program      text not null,
  message      text default '',
  company_id   text references public.companies(id),
  created_at   timestamptz default now()
);

-- 2. REACTIONS
create table if not exists public.reactions (
  id             uuid primary key default gen_random_uuid(),
  recognition_id uuid not null references public.recognitions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  emoji          text not null,
  created_at     timestamptz default now(),
  unique (recognition_id, user_id, emoji)
);

-- 3. COMMENTS
create table if not exists public.comments (
  id             uuid primary key default gen_random_uuid(),
  recognition_id uuid not null references public.recognitions(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  message        text not null,
  created_at     timestamptz default now()
);

-- 4. REWARDS
create table if not exists public.rewards (
  id          uuid primary key default gen_random_uuid(),
  company_id  text references public.companies(id),
  name        text not null,
  description text,
  points_cost integer not null check (points_cost > 0),
  category    text default 'general',
  available   boolean default true,
  created_at  timestamptz default now()
);

-- 5. REDEMPTIONS
create table if not exists public.redemptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  reward_id    uuid not null references public.rewards(id),
  points_spent integer not null,
  status       text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz default now()
);

-- 6. NOTIFICATIONS
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  data       jsonb default '{}',
  read       boolean default false,
  created_at timestamptz default now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.recognitions  enable row level security;
alter table public.reactions     enable row level security;
alter table public.comments      enable row level security;
alter table public.rewards       enable row level security;
alter table public.redemptions   enable row level security;
alter table public.notifications enable row level security;

-- Recognitions: same company or superadmin
create policy "recognitions_select" on public.recognitions for select to authenticated
  using (public.my_role() = 'superadmin' or company_id = public.my_company_id());

create policy "recognitions_insert" on public.recognitions for insert to authenticated
  with check (from_user_id = auth.uid());

-- Reactions: all authenticated
create policy "reactions_select" on public.reactions for select to authenticated using (true);
create policy "reactions_insert" on public.reactions for insert to authenticated
  with check (user_id = auth.uid());
create policy "reactions_delete" on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- Comments: all authenticated
create policy "comments_select" on public.comments for select to authenticated using (true);
create policy "comments_insert" on public.comments for insert to authenticated
  with check (user_id = auth.uid());

-- Rewards: company-scoped
create policy "rewards_select" on public.rewards for select to authenticated
  using (company_id = public.my_company_id() or public.my_role() = 'superadmin');
create policy "rewards_manage" on public.rewards for all to authenticated
  using (public.my_role() in ('admin', 'superadmin'));

-- Redemptions
create policy "redemptions_select" on public.redemptions for select to authenticated
  using (user_id = auth.uid() or public.my_role() in ('admin', 'superadmin'));
create policy "redemptions_insert" on public.redemptions for insert to authenticated
  with check (user_id = auth.uid());

-- Notifications: own only
create policy "notifications_select" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = auth.uid());
create policy "notifications_delete" on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ─── ATOMIC RPC: send_recognition ────────────────────────────────────────────
create or replace function public.send_recognition(
  p_to_user_id uuid,
  p_points     integer,
  p_program    text,
  p_message    text,
  p_company_id text
) returns uuid
language plpgsql security definer as $$
declare
  v_id           uuid;
  v_from_user_id uuid;
  v_from_points  integer;
begin
  v_from_user_id := auth.uid();
  select points_to_give into v_from_points
    from public.profiles where id = v_from_user_id for update;

  if v_from_points < p_points then
    raise exception 'insufficient_points';
  end if;

  update public.profiles set points_to_give   = points_to_give   - p_points where id = v_from_user_id;
  update public.profiles set points_to_redeem = points_to_redeem + p_points where id = p_to_user_id;

  insert into public.recognitions (from_user_id, to_user_id, points, program, message, company_id)
    values (v_from_user_id, p_to_user_id, p_points, p_program, p_message, p_company_id)
    returning id into v_id;

  insert into public.notifications (user_id, type, data)
    values (p_to_user_id, 'recognition', jsonb_build_object(
      'recognition_id', v_id,
      'from_user_id',   v_from_user_id,
      'points',         p_points,
      'program',        p_program,
      'message',        p_message
    ));

  return v_id;
end;
$$;

-- ─── ATOMIC RPC: redeem_reward ────────────────────────────────────────────────
create or replace function public.redeem_reward(
  p_reward_id uuid
) returns uuid
language plpgsql security definer as $$
declare
  v_id          uuid;
  v_user_id     uuid;
  v_cost        integer;
  v_user_points integer;
begin
  v_user_id := auth.uid();
  select points_cost into v_cost from public.rewards where id = p_reward_id and available = true;
  if not found then raise exception 'reward_not_found'; end if;

  select points_to_redeem into v_user_points
    from public.profiles where id = v_user_id for update;

  if v_user_points < v_cost then raise exception 'insufficient_points'; end if;

  update public.profiles set points_to_redeem = points_to_redeem - v_cost where id = v_user_id;

  insert into public.redemptions (user_id, reward_id, points_spent)
    values (v_user_id, p_reward_id, v_cost) returning id into v_id;

  return v_id;
end;
$$;

-- ─── TRIGGER: notificación al recibir una reaction ───────────────────────────
create or replace function public.handle_new_reaction()
returns trigger language plpgsql security definer as $$
declare v_owner_id uuid;
begin
  select from_user_id into v_owner_id from public.recognitions where id = new.recognition_id;
  if v_owner_id is distinct from new.user_id then
    insert into public.notifications (user_id, type, data)
      values (v_owner_id, 'reaction', jsonb_build_object(
        'recognition_id', new.recognition_id,
        'from_user_id',   new.user_id,
        'emoji',          new.emoji
      ));
  end if;
  return new;
end;
$$;

drop trigger if exists on_new_reaction on public.reactions;
create trigger on_new_reaction
  after insert on public.reactions
  for each row execute function public.handle_new_reaction();

-- ─── SEED: rewards por empresa ────────────────────────────────────────────────
insert into public.rewards (company_id, name, description, points_cost, category) values
  ('comp-1', 'Gift Card Amazon $10',  'Vale de compra en Amazon',         200, 'gift_card'),
  ('comp-1', 'Día libre',             'Un día extra de vacaciones',        500, 'time_off'),
  ('comp-1', 'Merch Allay',           'Remera + buzo de la empresa',       150, 'merch'),
  ('comp-2', 'Gift Card Amazon $10',  'Vale de compra en Amazon',         200, 'gift_card'),
  ('comp-2', 'Día libre',             'Un día extra de vacaciones',        500, 'time_off'),
  ('comp-2', 'Merch Allay',           'Remera + buzo de la empresa',       150, 'merch'),
  ('comp-3', 'Gift Card Spotify',     'Suscripción Spotify 1 mes',        100, 'gift_card'),
  ('comp-3', 'Día libre',             'Un día extra de vacaciones',        500, 'time_off')
on conflict do nothing;
