-- =====================================================================
-- Cocheras Comafi - Reservas diarias + máximo una cochera por usuario
-- por día
--
-- Cambios de modelo:
--
-- 1) Las reservas dejan de ser por franja horaria y pasan a ser por día
--    completo: una reserva = una cochera + una fecha (columna `fecha`).
--    Se elimina el rango `fecha_inicio`/`fecha_fin`. `check_in_at` y
--    `check_out_at` siguen siendo timestamps (el check-in/check-out
--    real ocurre en un momento preciso del día reservado).
--
-- 2) `parking_rules.horas_max_por_reserva` deja de tener sentido (ya no
--    hay franja horaria) y se elimina. `parking_rules.minutos_tolerancia_no_show`
--    también se elimina: se reemplaza por `hora_limite_checkin` (hora del
--    día, default 11:00): si al llegar esa hora del día reservado no hubo
--    check-in, el job de no-show libera la reserva.
--
-- 3) Regla de negocio "máximo una cochera por usuario por día":
--      a) Si el usuario tiene una cochera fija asignada ese día de la
--         semana y no la liberó para esa fecha puntual, no puede
--         reservar otra cochera ese día (trigger, mensaje claro).
--      b) Un usuario no puede tener dos reservas activas (propias, no de
--         invitados) el mismo día: se modela con un índice único parcial
--         sobre (user_id, fecha) para estado='activa' — trivial una vez
--         que la reserva es por día completo.
--      c) Las reservas de invitados (guest_id, user_id null) NO cuentan
--         contra el cupo del colaborador que las crea.
--
-- Ejecutar después de 0001/0002/0003/0004 con:
--   supabase db push  (o pegar en el SQL editor del proyecto)
--
-- Importante: esta migración transforma datos existentes de
-- reservations (fecha_inicio/fecha_fin -> fecha) y de parking_rules
-- (horas_max_por_reserva/minutos_tolerancia_no_show -> hora_limite_checkin).
-- Pensada para correr sobre una base que ya tiene 0001-0004 aplicadas y
-- puede tener filas reales.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. reservations: fecha_inicio/fecha_fin -> fecha (día completo)
-- ---------------------------------------------------------------------
alter table public.reservations add column if not exists fecha date;

-- Las reservas existentes se insertaban con fecha_inicio en UTC (ver
-- app/actions/reservations.ts, que usaba `Date#toISOString()`); tomamos
-- el día calendario en UTC para que la migración sea consistente con
-- cómo se generaron esos timestamps.
update public.reservations
set fecha = (fecha_inicio at time zone 'utc')::date
where fecha is null;

alter table public.reservations alter column fecha set not null;

alter table public.reservations drop constraint if exists reservations_fechas_validas;

drop index if exists idx_reservations_fecha_inicio;

alter table public.reservations drop column if exists fecha_inicio;
alter table public.reservations drop column if exists fecha_fin;

create index if not exists idx_reservations_fecha on public.reservations (fecha);

comment on column public.reservations.fecha is
  'Fecha (día completo) de la reserva. El modelo de reservas es diario: una reserva = una cochera + un día, no una franja horaria.';

-- Máximo una cochera por usuario por día: índice único parcial. Excluye
-- filas sin user_id (reservas de invitados, que no cuentan contra el
-- cupo de nadie) y reservas no activas (canceladas/completadas/no_show
-- no compiten por el cupo del día).
drop index if exists uq_reservations_user_fecha_activa;
create unique index uq_reservations_user_fecha_activa
  on public.reservations (user_id, fecha)
  where estado = 'activa' and user_id is not null;

comment on index public.uq_reservations_user_fecha_activa is
  'Un usuario no puede tener más de una reserva activa (propia, no de invitado) el mismo día, sin importar la cochera.';

-- ---------------------------------------------------------------------
-- 2. Trigger anti-solapamiento de la cochera: ahora es por fecha
--    calendario, no por franja horaria.
-- ---------------------------------------------------------------------
create or replace function public.reservations_no_overlap() returns trigger as $$
begin
  if new.estado = 'activa' then
    if exists (
      select 1 from public.reservations r
      where r.spot_id = new.spot_id
        and r.estado = 'activa'
        and r.id <> new.id
        and r.fecha = new.fecha
    ) then
      raise exception 'La cochera ya tiene una reserva activa para ese día';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- el trigger trg_reservations_no_overlap (creado en 0001) ya apunta a
-- esta función; no hace falta recrearlo.

-- ---------------------------------------------------------------------
-- 3. Trigger: si el usuario tiene su cochera fija asignada ese día de
--    la semana y no la liberó para esa fecha puntual, no puede reservar
--    otra cochera ese mismo día. No aplica a reservas de invitados
--    (user_id null).
-- ---------------------------------------------------------------------
create or replace function public.reservations_bloquea_dia_fijo_no_liberado() returns trigger as $$
declare
  v_bloqueado boolean;
begin
  if new.estado = 'activa' and new.user_id is not null then
    select exists (
      select 1
      from public.fixed_spot_assignments a
      where a.user_id = new.user_id
        and extract(isodow from new.fecha)::smallint = any(a.dias)
        and not exists (
          select 1 from public.fixed_spot_releases r
          where r.assignment_id = a.id
            and r.estado = 'activa'
            and r.fecha_desde <= new.fecha
            and r.fecha_hasta >= new.fecha
        )
    ) into v_bloqueado;

    if v_bloqueado then
      raise exception 'Ya tenés tu cochera fija asignada ese día. Si no la vas a usar, liberala primero.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_reservations_bloquea_dia_fijo on public.reservations;
create trigger trg_reservations_bloquea_dia_fijo
  before insert or update on public.reservations
  for each row execute function public.reservations_bloquea_dia_fijo_no_liberado();

comment on function public.reservations_bloquea_dia_fijo_no_liberado() is
  'Rechaza una reserva puntual si el usuario tiene cochera fija asignada ese día de la semana y no la liberó para esa fecha. Si la liberó, puede reservar otra cochera ese día (ej. va a otro edificio).';

-- ---------------------------------------------------------------------
-- 4. parking_rules: horas_max_por_reserva y minutos_tolerancia_no_show
--    -> hora_limite_checkin.
-- ---------------------------------------------------------------------
alter table public.parking_rules
  add column if not exists hora_limite_checkin time not null default '11:00';

alter table public.parking_rules drop column if exists horas_max_por_reserva;
alter table public.parking_rules drop column if exists minutos_tolerancia_no_show;

comment on column public.parking_rules.hora_limite_checkin is
  'Hora límite del día reservado para hacer check-in. Si se supera sin check-in, el job de no-show libera la reserva. Reemplaza a minutos_tolerancia_no_show (que asumía reservas por franja horaria) y a horas_max_por_reserva (ya no aplica: la reserva es siempre por día completo).';

-- ---------------------------------------------------------------------
-- 5. release_no_show_reservations: adaptada al modelo diario. Libera
--    reservas activas sin check-in cuando: (a) el día reservado ya pasó
--    (fecha < hoy), o (b) es hoy y ya se cruzó `hora_limite_checkin`
--    (regla del edificio, o global, o 11:00 por defecto).
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
      and r.fecha <= current_date
      and (
        r.fecha < current_date
        or now()::time > coalesce(
          (select pr.hora_limite_checkin from public.parking_rules pr where pr.building_id = ps.building_id),
          (select pr.hora_limite_checkin from public.parking_rules pr where pr.building_id is null),
          '11:00'::time
        )
      )
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
        'Tu reserva fue liberada automáticamente por falta de check-in antes de la hora límite.'
      );
    end if;

    return next rec;
  end loop;
  return;
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.release_no_show_reservations() is
  'Libera reservas "activa" sin check-in del día actual o de días pasados, según parking_rules.hora_limite_checkin. Pensada para ser invocada periódicamente (pg_cron -> pg_net -> Edge Function, o Supabase Scheduled Function).';
