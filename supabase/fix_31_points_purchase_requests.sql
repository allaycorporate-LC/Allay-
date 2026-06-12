-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #31: Solicitudes de compra de puntos
--
-- Cuando un admin "compra puntos" desde Gestión de puntos, queda registrada
-- una solicitud pendiente. El superadmin la ve, la aprueba/rechaza, y luego
-- carga los puntos manualmente (el pago se coordina por mail/facturación).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.points_purchase_requests (
  id            uuid        primary key default gen_random_uuid(),
  company_id    text        not null,
  requested_by  uuid        references public.profiles(id) on delete set null,
  points        integer     not null,
  status        text        not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  processed_by  uuid        references public.profiles(id) on delete set null
);

create index if not exists ppr_company_status_idx
  on public.points_purchase_requests(company_id, status);

create index if not exists ppr_created_idx
  on public.points_purchase_requests(created_at desc);

alter table public.points_purchase_requests enable row level security;

-- Admins/superadmins pueden crear solicitudes para su propia empresa
create policy "ppr_insert"
  on public.points_purchase_requests for insert
  to authenticated
  with check (
    public.my_role() in ('admin','superadmin')
    and company_id = public.my_company_id()
  );

-- Admins ven las solicitudes de su empresa; superadmin ve todas
create policy "ppr_select"
  on public.points_purchase_requests for select
  to authenticated
  using (
    public.my_role() = 'superadmin'
    or (company_id = public.my_company_id() and public.my_role() in ('admin','superadmin'))
  );

-- Solo el superadmin puede aprobar/rechazar
create policy "ppr_update"
  on public.points_purchase_requests for update
  to authenticated
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');
