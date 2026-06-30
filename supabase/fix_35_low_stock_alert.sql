-- ══════════════════════════════════════════════════════════════════════════════
-- Fix #35: Alerta por mail de stock bajo
--
-- Cuando el stock de un producto baja a 3 unidades o menos (ya sea por un
-- canje o porque el superadmin lo actualiza manualmente), se llama a la
-- edge function "send-low-stock-alert" que manda un mail a
-- allay.corporate@gmail.com.
--
-- PASO 1: Desplegar la edge function SIN verificación de JWT:
--         supabase functions deploy send-low-stock-alert --no-verify-jwt
--
-- PASO 2: Configurar el secreto compartido:
--         supabase secrets set LOW_STOCK_ALERT_SECRET=<tu-secreto>
--
-- PASO 3: Reemplazar YOUR_LOW_STOCK_SECRET abajo por el mismo valor
--         que usaste en el paso 2 y correr este SQL en el SQL Editor.
--
-- IMPORTANTE: nunca commitear el secreto real a GitHub.
--             Este archivo debe usar siempre el placeholder YOUR_LOW_STOCK_SECRET.
-- ══════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_net;

create or replace function public.notify_low_stock()
returns trigger language plpgsql security definer as $$
begin
  if new.stock is not null and new.stock <= 3
     and (old.stock is null or old.stock > 3) then
    perform net.http_post(
      url     := 'https://smuwnjpmpmwfuysrxkaa.supabase.co/functions/v1/send-low-stock-alert',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_LOW_STOCK_SECRET"}'::jsonb,
      body    := jsonb_build_object('reward_id', new.id, 'name', new.name, 'stock', new.stock)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_low_stock on public.rewards;
create trigger trg_notify_low_stock
  after update of stock on public.rewards
  for each row execute function public.notify_low_stock();
