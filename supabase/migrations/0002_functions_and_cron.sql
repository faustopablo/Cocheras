-- =====================================================================
-- Cocheras Comafi - Funciones de negocio + registro de cron job
-- =====================================================================

-- ---------------------------------------------------------------------
-- Función: libera reservas activas sin check-in que superaron la
-- tolerancia configurada en parking_rules (por edificio o global).
-- La llama la Edge Function `release-no-shows` (vía pg_cron/pg_net)
-- pero también puede ejecutarse manualmente con:
--   select public.release_no_show_reservations();
-- ---------------------------------------------------------------------
create or replace function public.release_no_show_reservations()
returns setof public.reservations as $$
declare
  rec record;
begin
  for rec in
    select r.*, ps.building_id
    from public.reservations r
    join public.parking_spots ps on ps.id = r.spot_id
    where r.estado = 'activa'
      and r.check_in_at is null
      and r.fecha_inicio + (
        coalesce(
          (select pr.minutos_tolerancia_no_show from public.parking_rules pr where pr.building_id = ps.building_id),
          (select pr.minutos_tolerancia_no_show from public.parking_rules pr where pr.building_id is null),
          30
        ) || ' minutes'
      )::interval < now()
  loop
    update public.reservations
      set estado = 'no_show'
      where id = rec.id;

    update public.parking_spots
      set estado = 'libre'
      where id = rec.spot_id;

    if rec.user_id is not null then
      insert into public.notifications (user_id, tipo, mensaje)
      values (
        rec.user_id,
        'no_show_liberada',
        'Tu reserva fue liberada automáticamente por falta de check-in dentro del tiempo de tolerancia.'
      );
    end if;

    return next rec;
  end loop;
  return;
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.release_no_show_reservations() is
  'Libera reservas "activa" sin check-in vencidas según parking_rules.minutos_tolerancia_no_show. Pensada para ser invocada periódicamente (pg_cron -> pg_net -> Edge Function, o Supabase Scheduled Function).';

-- ---------------------------------------------------------------------
-- Función: el dueño de una cochera fija la libera para que la pueda
-- reservar cualquier colaborador (origen 'fija_liberada').
-- ---------------------------------------------------------------------
create or replace function public.release_fixed_spot(p_spot_id uuid)
returns public.parking_spots as $$
declare
  v_spot public.parking_spots;
begin
  select * into v_spot from public.parking_spots where id = p_spot_id;

  if v_spot is null then
    raise exception 'Cochera no encontrada';
  end if;

  if v_spot.tipo <> 'fija' or v_spot.assigned_user_id is distinct from auth.uid() then
    raise exception 'Solo el titular de la cochera fija puede liberarla';
  end if;

  update public.parking_spots
    set estado = 'libre'
    where id = p_spot_id
    returning * into v_spot;

  return v_spot;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.release_fixed_spot(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Función: el dueño retoma su cochera fija. Cancela cualquier reserva
-- activa de terceros sobre esa cochera y la vuelve a bloquear.
-- ---------------------------------------------------------------------
create or replace function public.reclaim_fixed_spot(p_spot_id uuid)
returns public.parking_spots as $$
declare
  v_spot public.parking_spots;
  v_res record;
begin
  select * into v_spot from public.parking_spots where id = p_spot_id;

  if v_spot is null then
    raise exception 'Cochera no encontrada';
  end if;

  if v_spot.tipo <> 'fija' or v_spot.assigned_user_id is distinct from auth.uid() then
    raise exception 'Solo el titular de la cochera fija puede retomarla';
  end if;

  for v_res in
    select * from public.reservations
    where spot_id = p_spot_id and estado = 'activa'
  loop
    update public.reservations set estado = 'cancelada' where id = v_res.id;

    if v_res.user_id is not null then
      insert into public.notifications (user_id, tipo, mensaje)
      values (
        v_res.user_id,
        'reserva_cancelada',
        'Tu reserva fue cancelada porque el titular retomó su cochera fija.'
      );
    end if;
  end loop;

  update public.parking_spots
    set estado = 'bloqueada'
    where id = p_spot_id
    returning * into v_spot;

  return v_spot;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.reclaim_fixed_spot(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Registro del cron job con pg_cron + pg_net
--
-- Requiere habilitar las extensiones "pg_cron" y "pg_net" desde el
-- dashboard de Supabase (Database > Extensions) o con:
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
-- Opción A (recomendada): invocar la función SQL directamente cada 5
-- minutos, sin pasar por una Edge Function:
--
--   select cron.schedule(
--     'release-no-shows-sql',
--     '*/5 * * * *',
--     $$ select public.release_no_show_reservations(); $$
--   );
--
-- Opción B: invocar la Edge Function (supabase/functions/release-no-shows)
-- vía pg_net, útil si además querés disparar el envío de emails desde ahí:
--
--   select cron.schedule(
--     'release-no-shows-edge-fn',
--     '*/5 * * * *',
--     $$
--     select net.http_post(
--       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/release-no-shows',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY_O_ANON_SEGUN_AUTH_DE_LA_FUNCION>'
--       ),
--       body := '{}'::jsonb
--     );
--     $$
--   );
--
-- Para ver los jobs registrados: select * from cron.job;
-- Para desactivar uno: select cron.unschedule('release-no-shows-sql');
-- ---------------------------------------------------------------------
