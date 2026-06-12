-- ══════════════════════════════════════════════════════════════════════════════
-- Fix #34: Stock de productos de la Store
--
-- Agrega una columna "stock" a "rewards" (NULL = sin límite) y actualiza
-- redeem_reward() para que valide y descuente stock al canjear.
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.rewards add column if not exists stock integer;

create or replace function public.redeem_reward(
  p_reward_id uuid
) returns uuid
language plpgsql security definer as $$
declare
  v_id          uuid;
  v_user_id     uuid;
  v_cost        integer;
  v_stock       integer;
  v_user_points integer;
begin
  v_user_id := auth.uid();

  select points_cost, stock into v_cost, v_stock
    from public.rewards where id = p_reward_id and available = true
    for update;
  if not found then raise exception 'reward_not_found'; end if;

  if v_stock is not null and v_stock <= 0 then
    raise exception 'out_of_stock';
  end if;

  select points_to_redeem into v_user_points
    from public.profiles where id = v_user_id for update;

  if v_user_points < v_cost then raise exception 'insufficient_points'; end if;

  update public.profiles set points_to_redeem = points_to_redeem - v_cost where id = v_user_id;

  if v_stock is not null then
    update public.rewards set stock = stock - 1 where id = p_reward_id;
  end if;

  insert into public.redemptions (user_id, reward_id, points_spent)
    values (v_user_id, p_reward_id, v_cost) returning id into v_id;

  return v_id;
end;
$$;
