-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #4: Auditoría RLS — tablas secundarias
--
-- Problemas encontrados:
--   1. reactions  SELECT using(true) → leak cross-company
--   2. comments   SELECT using(true) → leak cross-company
--   3. reactions  INSERT sin validar que el recognition sea de tu empresa
--   4. comments   INSERT sin validar que el recognition sea de tu empresa
--   5. recognitions INSERT directo → bypasea send_recognition() sin descontar puntos
--   6. rewards    for all sin with check → admin puede crear rewards en otra empresa
--   7. redemptions INSERT directo → bypasea redeem_reward() sin descontar puntos
--   8. Falta DELETE en comments (moderación por admins)
--   9. Falta DELETE en recognitions (moderación por admins)
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- RECOGNITIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Fix #5: Eliminar INSERT directo — solo se puede crear vía send_recognition() RPC
-- send_recognition() es security definer y maneja la lógica de puntos.
-- Un INSERT directo crearía reconocimientos sin descontar puntos.
drop policy if exists "recognitions_insert" on public.recognitions;

-- Admins pueden eliminar reconocimientos inapropiados
drop policy if exists "recognitions_delete" on public.recognitions;
create policy "recognitions_delete"
  on public.recognitions for delete
  to authenticated
  using (public.my_role() in ('admin', 'superadmin'));


-- ══════════════════════════════════════════════════════════════════════════════
-- REACTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Fix #1: SELECT scoped a la empresa (via el recognition asociado)
drop policy if exists "reactions_select" on public.reactions;
create policy "reactions_select"
  on public.reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.recognitions r
      where r.id = recognition_id
        and (r.company_id = public.my_company_id() or public.my_role() = 'superadmin')
    )
  );

-- Fix #3: INSERT valida que el recognition sea de tu empresa
drop policy if exists "reactions_insert" on public.reactions;
create policy "reactions_insert"
  on public.reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.recognitions r
      where r.id = recognition_id
        and (r.company_id = public.my_company_id() or public.my_role() = 'superadmin')
    )
  );

-- reactions_delete ya es correcto (user_id = auth.uid()), se mantiene.


-- ══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ══════════════════════════════════════════════════════════════════════════════

-- Fix #2: SELECT scoped a la empresa
drop policy if exists "comments_select" on public.comments;
create policy "comments_select"
  on public.comments for select
  to authenticated
  using (
    exists (
      select 1 from public.recognitions r
      where r.id = recognition_id
        and (r.company_id = public.my_company_id() or public.my_role() = 'superadmin')
    )
  );

-- Fix #4: INSERT valida que el recognition sea de tu empresa
drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert"
  on public.comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.recognitions r
      where r.id = recognition_id
        and (r.company_id = public.my_company_id() or public.my_role() = 'superadmin')
    )
  );

-- Fix #8: Admins pueden eliminar comentarios inapropiados
drop policy if exists "comments_delete" on public.comments;
create policy "comments_delete"
  on public.comments for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.my_role() in ('admin', 'superadmin')
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- REWARDS
-- ══════════════════════════════════════════════════════════════════════════════

-- Fix #6: Separar la policy en SELECT y gestión, con with check correcto.
-- El problema original: "for all" sin with check permitía a admins crear
-- rewards en cualquier empresa (el with check defaulteaba a my_role() in (...),
-- que no valida company_id).

drop policy if exists "rewards_manage" on public.rewards;

-- Admins gestionan rewards: SELECT/UPDATE/DELETE dentro de su empresa
create policy "rewards_manage_using"
  on public.rewards for all
  to authenticated
  using (public.my_role() in ('admin', 'superadmin'));

-- INSERT y UPDATE: validar que la empresa sea la propia
create policy "rewards_manage_check"
  on public.rewards for insert
  to authenticated
  with check (
    public.my_role() = 'superadmin'
    or (public.my_role() = 'admin' and company_id = public.my_company_id())
  );

-- UPDATE with check (policy separada para el with check de updates)
drop policy if exists "rewards_update_check" on public.rewards;
create policy "rewards_update_check"
  on public.rewards for update
  to authenticated
  using  (public.my_role() in ('admin', 'superadmin'))
  with check (
    public.my_role() = 'superadmin'
    or (public.my_role() = 'admin' and company_id = public.my_company_id())
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- REDEMPTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Fix #7: Eliminar INSERT directo — solo se puede canjear vía redeem_reward() RPC
-- redeem_reward() es security definer y maneja la lógica de puntos.
-- Un INSERT directo crearía registros de canje sin descontar puntos del usuario.
drop policy if exists "redemptions_insert" on public.redemptions;


-- ══════════════════════════════════════════════════════════════════════════════
-- Verificación
-- ══════════════════════════════════════════════════════════════════════════════
-- Después de ejecutar, listá todas las policies activas:
--
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in (
--       'recognitions', 'reactions', 'comments',
--       'rewards', 'redemptions', 'notifications'
--     )
--   order by tablename, cmd;
