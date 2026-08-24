-- =====================================================================
-- Cocheras Comafi - "Hoy" en hora argentina (America/Argentina/Buenos_Aires)
--
-- Bug: las funciones que validan o cierran reservas usaban
-- `current_date`, que se evalúa en el timezone del servidor (UTC en
-- Supabase). Como ART = UTC-3, desde las 21:00 hora argentina la fecha
-- UTC ya es "mañana" y, por ejemplo, una liberación para hoy se
-- rechazaba como "fecha pasada", y complete_past_reservations() podía
-- completar reservas de hoy tres horas antes de que termine el día.
--
-- Fix: se redefinen (create or replace) las funciones y la vista que
-- comparaban contra `current_date`, usando en su lugar
-- `(now() at time zone 'America/Argentina/Buenos_Aires')::date`.
-- No se modifica ningún archivo 0001-0006: esta migración pisa las
-- definiciones vigentes (create_fixed_spot_release de 0004,
-- fixed_spots_release_status de 0004 y complete_past_reservations de
-- 0006). is_fixed_spot_released no cambia: recibe las fechas por
-- parámetro y no usa current_date.
--
-- Ejecutar después de 0001-0006 con:
--   supabase db push  (o pegar en el SQL editor del proyecto)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: fecha "de hoy" en hora argentina. Centraliza la expresión para
-- que ninguna función vuelva a depender del timezone del servidor.
-- ---------------------------------------------------------------------
create or replace function public.hoy_argentina()
returns date as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$ language sql stable;

grant execute on function public.hoy_argentina() to authenticated;

comment on function public.hoy_argentina() is
  'Fecha actual en America/Argentina/Buenos_Aires. Usar en lugar de current_date (que depende del timezone del servidor, UTC en Supabase).';

-- ---------------------------------------------------------------------
-- 1. create_fixed_spot_release: la validación "fecha desde no puede
--    estar en el pasado" ahora compara contra hoy en hora argentina.
--    (Redefine la versión de 0004, misma firma.)
-- ---------------------------------------------------------------------
create or replace function public.create_fixed_spot_release(
  p_assignment_id uuid,
  p_fecha_desde date,
  p_fecha_hasta date,
  p_motivo text default null
) returns public.fixed_spot_releases as $$
declare
  v_assignment public.fixed_spot_assignments;
  v_release public.fixed_spot_releases;
begin
  select * into v_assignment from public.fixed_spot_assignments where id = p_assignment_id;

  if v_assignment is null then
    raise exception 'Asignación no encontrada';
  end if;

  if v_assignment.user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Solo el titular de la asignación puede liberarla';
  end if;

  if p_fecha_hasta < p_fecha_desde then
    raise exception 'La fecha hasta no puede ser anterior a la fecha desde';
  end if;

  if p_fecha_desde < public.hoy_argentina() then
    raise exception 'La fecha desde no puede estar en el pasado';
  end if;

  insert into public.fixed_spot_releases (spot_id, user_id, assignment_id, fecha_desde, fecha_hasta, motivo, estado)
  values (
    v_assignment.spot_id,
    v_assignment.user_id,
    v_assignment.id,
    p_fecha_desde,
    p_fecha_hasta,
    p_motivo,
    'activa'
  )
  returning * into v_release;

  return v_release;
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.create_fixed_spot_release(uuid, date, date, text) is
  'Crea una liberación por rango de fechas para una asignación (dueño + días) de una cochera fija. Valida "pasado" contra hoy en hora argentina (ver 0007).';

-- ---------------------------------------------------------------------
-- 2. complete_past_reservations: "fecha ya pasada" en hora argentina.
--    (Redefine la versión de 0006, misma firma.)
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
      and r.fecha < public.hoy_argentina()
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
  'Marca como completada toda reserva "activa" cuya fecha ya pasó según hoy en hora argentina (ver 0007). Pensada para ejecutarse una vez por día (pg_cron, o Supabase Scheduled Function).';

-- ---------------------------------------------------------------------
-- 3. fixed_spots_release_status: "hoy" (dueño y liberación) en hora
--    argentina. (Redefine la vista de 0004, mismas columnas.)
-- ---------------------------------------------------------------------
create or replace view public.fixed_spots_release_status as
select
  ps.id as spot_id,
  ps.building_id,
  (
    select a.user_id
    from public.fixed_spot_assignments a
    where a.spot_id = ps.id
      and extract(isodow from public.hoy_argentina())::smallint = any(a.dias)
    limit 1
  ) as dueno_hoy,
  public.is_fixed_spot_released(ps.id, public.hoy_argentina()) as liberada_hoy
from public.parking_spots ps
where ps.tipo = 'fija';

comment on view public.fixed_spots_release_status is
  'Para cada cochera fija: quién es el dueño de hoy (hora argentina; null si hoy no tiene dueño) y si hoy está disponible para que la reserve un tercero.';
