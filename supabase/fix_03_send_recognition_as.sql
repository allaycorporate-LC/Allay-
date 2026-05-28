-- ─────────────────────────────────────────────────────────────────────────────
-- Fix #3: Restringir send_recognition_as a service_role únicamente
--
-- Problema: la función es pública y cualquier usuario autenticado puede
-- invocarla vía RPC para enviar reconocimientos como si fuera otra persona,
-- bypasseando auth.uid() completamente.
--
-- Solución en dos capas:
--   1. REVOKE EXECUTE de roles no privilegiados (primera línea de defensa)
--   2. Check del JWT claim dentro de la función (defensa en profundidad)
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Capa 1: Revocar permisos de ejecución ─────────────────────────────────────
-- Por defecto en PostgreSQL, las funciones son ejecutables por PUBLIC.
-- Revocar explícitamente de anon y authenticated.

revoke execute
  on function public.send_recognition_as(uuid, uuid, integer, text, text, text)
  from public, anon, authenticated;

-- Solo service_role puede ejecutarla
grant execute
  on function public.send_recognition_as(uuid, uuid, integer, text, text, text)
  to service_role;


-- ── Capa 2: Verificación interna del JWT claim ────────────────────────────────
-- En Supabase, el JWT de cada request contiene un campo "role":
--   - anon key         → "role": "anon"
--   - JWT de usuario   → "role": "authenticated"
--   - service role key → "role": "service_role"
--
-- La función es security definer (corre como postgres), pero
-- current_setting('request.jwt.claims') sigue reflejando el JWT original
-- del request que la invocó.

create or replace function public.send_recognition_as(
  p_from_user_id uuid,
  p_to_user_id   uuid,
  p_points       integer,
  p_program      text,
  p_message      text,
  p_company_id   text
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id          uuid;
  v_from_points integer;
  v_jwt_role    text;
begin
  -- Verificar que el caller es service_role
  v_jwt_role := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  );

  if v_jwt_role <> 'service_role' then
    raise exception 'insufficient_privilege'
      using
        hint    = 'send_recognition_as solo puede ser invocada con service_role key',
        errcode = 'insufficient_privilege';
  end if;

  -- Validaciones básicas de integridad
  if p_from_user_id = p_to_user_id then
    raise exception 'invalid_argument'
      using hint = 'El sender y el recipient no pueden ser la misma persona';
  end if;

  if p_points < 0 then
    raise exception 'invalid_argument'
      using hint = 'Los puntos no pueden ser negativos';
  end if;

  -- Verificar puntos disponibles del sender (lock para evitar race conditions)
  select points_to_give into v_from_points
    from public.profiles
    where id = p_from_user_id
    for update;

  if not found then
    raise exception 'not_found'
      using hint = 'Sender no encontrado';
  end if;

  if v_from_points < p_points then
    raise exception 'insufficient_points';
  end if;

  -- Transferir puntos
  update public.profiles
    set points_to_give = points_to_give - p_points
    where id = p_from_user_id;

  update public.profiles
    set points_to_redeem = points_to_redeem + p_points
    where id = p_to_user_id;

  -- Registrar el reconocimiento
  insert into public.recognitions (from_user_id, to_user_id, points, program, message, company_id)
    values (p_from_user_id, p_to_user_id, p_points, p_program, p_message, p_company_id)
    returning id into v_id;

  -- Notificar al destinatario
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


-- ── Verificación ──────────────────────────────────────────────────────────────
-- Después de ejecutar, podés verificar los permisos con:
--
--   select grantee, privilege_type
--   from information_schema.routine_privileges
--   where routine_name = 'send_recognition_as'
--     and routine_schema = 'public';
--
-- Solo debe aparecer 'service_role' con EXECUTE.
-- No debe aparecer 'PUBLIC', 'anon', ni 'authenticated'.
