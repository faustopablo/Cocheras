-- =====================================================================
-- Cocheras Comafi - Eliminación del concepto de check-in/check-out
--
-- Decisión de producto: una reserva confirmada equivale a check-in
-- automático (la reserva diaria ya implica ocupación del día). Ya no
-- existe una acción explícita de check-in ni de check-out, y por lo
-- tanto tampoco tiene sentido liberar reservas por "no-show": una
-- reserva activa cuyo día ya pasó simplemente se marca 'completada'.
--
-- Cambios:
-- 1) reservations: se eliminan check_in_at y check_out_at.
-- 2) parking_rules: se elimina hora_limite_checkin (ya no hay check-in
--    que limitar).
-- 3) Se elimina release_no_show_reservations() y se desregistra el
--    cron job asociado (si existe, registrado en 0002 vía pg_cron como
--    'release-no-shows-sql'; también se limpia por compatibilidad el
--    nombre alternativo 'release-no-shows-edge-fn' documentado en el
--    mismo archivo, por si algún entorno lo llegó a programar).
-- 4) Se agrega complete_past_reservations(): marca 'completada' toda
--    reserva 'activa' cuya fecha ya pasó (fecha < current_date). Este
--    job reemplaza al de no-show y se debe programar diariamente (ver
--    comentario al final de este archivo).
--
-- Nota sobre el enum: el valor 'no_show' de public.estado_reserva NO se
-- elimina (Postgres no permite quitar valores de un enum de forma
-- simple/segura sin recrearlo). Las reservas históricas que ya hayan
-- quedado en 'no_show' se conservan como dato histórico; de acá en
-- adelante ninguna función ni acción de la app vuelve a producir ese
-- estado.
--
-- Ejecutar después de 0001-0005 con:
--   supabase db push  (o pegar en el SQL editor del proyecto)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Desregistrar el cron job de no-show, si llegó a programarse.
--    cron.unschedule levanta una excepción si el job no existe, así que
--    lo envolvemos para que la migración sea idempotente en cualquier
--    entorno (con o sin pg_cron habilitado, con o sin el job creado).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('release-no-shows-sql');
    exception when others then
      null; -- el job no existía con ese nombre; nada que hacer
    end;

    begin
      perform cron.unschedule('release-no-shows-edge-fn');
    exception when others then
      null; -- el job no existía con ese nombre; nada que hacer
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Eliminar la función de no-show (ya no aplica: no hay check-in).
-- ---------------------------------------------------------------------
drop function if exists public.release_no_show_reservations();

-- ---------------------------------------------------------------------
-- 2. reservations: eliminar check_in_at y check_out_at.
-- ---------------------------------------------------------------------
alter table public.reservations drop column if exists check_in_at;
alter table public.reservations drop column if exists check_out_at;

-- ---------------------------------------------------------------------
-- 3. parking_rules: eliminar hora_limite_checkin.
-- ---------------------------------------------------------------------
alter table public.parking_rules drop column if exists hora_limite_checkin;

-- ---------------------------------------------------------------------
-- 4. Nueva función: completa reservas activas cuyo día ya pasó.
--    Reemplaza al job de no-show: ya no hay tolerancia ni check-in que
--    verificar, solo si la fecha reservada quedó en el pasado.
-- ---------------------------------------------------------------------
create or replace function public.complete_past_reservations()
returns setof public.reservations as $$
declare
  rec record;
begin
  for rec in
    select r.*
    from public.reservations r
    where r.estado = 'activa'
      and r.fecha < current_date
  loop
    update public.reservations
      set estado = 'completada'
      where id = rec.id;

    return next rec;
  end loop;
  return;
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.complete_past_reservations() is
  'Marca como completada toda reserva "activa" cuya fecha ya pasó (fecha < current_date). Reemplaza a release_no_show_reservations() ahora que la reserva confirmada equivale a check-in automático. Pensada para ejecutarse una vez por día (pg_cron, o Supabase Scheduled Function).';

-- ---------------------------------------------------------------------
-- Programación diaria con pg_cron (reemplaza al job de no-show)
--
-- Requiere tener habilitada la extensión "pg_cron" (Database >
-- Extensions en el dashboard, o `create extension if not exists
-- pg_cron;`). No hace falta pg_net porque esta función no necesita
-- llamar a una Edge Function: alcanza con invocarla directo por SQL.
--
--   select cron.schedule(
--     'complete-past-reservations-sql',
--     '5 0 * * *',   -- todos los días a las 00:05
--     $$ select public.complete_past_reservations(); $$
--   );
--
-- Para ver los jobs registrados: select * from cron.job;
-- Para desactivar: select cron.unschedule('complete-past-reservations-sql');
-- ---------------------------------------------------------------------
