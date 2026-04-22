-- ─────────────────────────────────────────────────────────────────────────────
-- ALLAY — Supabase Schema
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Companies
create table if not exists public.companies (
  id     text primary key,
  name   text not null,
  domain text not null
);

insert into public.companies (id, name, domain) values
  ('comp-0', 'Superadmin',    '@superadmin.com'),
  ('comp-1', 'Tech Corp',     '@techcorp.com'),
  ('comp-2', 'Design Studio', '@designstudio.com'),
  ('comp-3', 'Marketing Pro', '@marketingpro.com')
on conflict (id) do nothing;

-- 2. Profiles (linked to auth.users)
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  name             text        not null,
  email            text        not null unique,
  department       text        default 'General',
  company_id       text        references public.companies(id),
  role             text        default 'employee'
                               check (role in ('employee', 'admin', 'superadmin')),
  points_to_give   integer     default 100,
  points_to_redeem integer     default 0,
  password_changed boolean     default false,
  created_at       timestamptz default now()
);

-- 3. Row Level Security
alter table public.profiles enable row level security;

-- SELECT: superadmin ve todos; el resto ve solo su empresa
create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (
    (select p.role from public.profiles p where p.id = auth.uid()) = 'superadmin'
    or company_id = (select p.company_id from public.profiles p where p.id = auth.uid())
  );

-- UPDATE: admins y superadmins pueden actualizar perfiles
create policy "profiles_update"
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or (select p.role from public.profiles p where p.id = auth.uid()) in ('admin', 'superadmin')
  )
  with check (true);

-- DELETE: admins y superadmins pueden eliminar perfiles
create policy "profiles_delete"
  on public.profiles for delete
  to authenticated
  using (
    (select p.role from public.profiles p where p.id = auth.uid()) in ('admin', 'superadmin')
  );

-- 4. Trigger: crear profile automáticamente al registrar un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, email, department, company_id, role,
    points_to_give, points_to_redeem, password_changed
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',         split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'department',   'General'),
    coalesce(new.raw_user_meta_data->>'company_id',   'comp-1'),
    coalesce(new.raw_user_meta_data->>'role',         'employee'),
    coalesce((new.raw_user_meta_data->>'points_to_give')::integer,   100),
    coalesce((new.raw_user_meta_data->>'points_to_redeem')::integer, 0),
    false
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
