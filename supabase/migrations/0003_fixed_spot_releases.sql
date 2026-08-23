-- =====================================================================
-- Cocheras Comafi - Liberación de cocheras fijas por rango de fechas
--
-- Reemplaza el modelo de toggle inmediato (release_fixed_spot /
-- reclaim_fixed_spot cambiando parking_spots.estado) por liberaciones
-- con rango de fechas (ej. vacaciones), registradas en
-- fixed_spot_releases. La disponibilidad de una cochera fija para que
-- la reserve un tercero (origen 'fija_liberada') se deriva ahora de si
-- existe una liberación activa que cubra la fecha/rango solicitado.
--
-- Ejecutar después de 0001_init.sql y 0002_functions_and_cron.sql con:
--   supabase db push  (o pegar en el SQL editor del proyecto)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipo enumerado
-- ---------------------------------------------------------------------
do $$ begin
  create type public.estado_liberacion as enum ('activa', 'cancelada');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tabla fixed_spot_releases
-- ---------------------------------------------------------------------
create table if not exists public.fixed_spot_releases (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.parking_spots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  fecha_desde date not null,
  fecha_hasta date not null,
  motivo text,
  estado public.estado_liberacion not null default 'activa',
  created_at timestamptz not null default now(),
  constraint fixed_spot_releases_fechas_validas check (fecha_hasta >= fecha_desde)
);

comment on table public.fixed_spot_releases is
  'Rangos de fechas en los que el titular de una cochera fija la libera para que la reserve un tercero (ej. vacaciones). Reemplaza al toggle inmediato en parking_spots.estado.';

create index if not exists idx_fixed_spot_releases_spot on public.fixed_spot_releases (spot_id);
create index if not exists idx_fixed_spot_releases_user on public.fixed_spot_releases (user_id);
create index if not exists idx_fixed_spot_releases_estado on public.fixed_spot_releases (estado);
create index if not exists idx_fixed_spot_releases_fechas on public.fixed_spot_releases (spot_id, fecha_desde, fecha_hasta);

-- ---------------------------------------------------------------------
-- Trigger: evita liberaciones activas superpuestas para la misma
-- cochera, y valida que la cochera sea de tipo 'fija'.
-- ---------------------------------------------------------------------
create or replace function public.fixed_spot_releases_no_overlap() returns trigger as $$
declare
  v_tipo public.tipo_cochera;
begin
  select tipo into v_tipo from public.parking_spots where id = new.spot_id;

  if v_tipo is null then
    raise exception 'Cochera no encontrada';
  end if;

  if v_tipo <> 'fija' then
    raise exception 'Solo se pueden crear liberaciones para cocheras de tipo fija';
  end if;

  if new.estado = 'activa' then
    if exists (
      select 1 from public.fixed_spot_releases r
      where r.spot_id = new.spot_id
        and r.estado = 'activa'
        and r.id <> new.id
        and daterange(r.fecha_desde, r.fecha_hasta, '[]') && daterange(new.fecha_desde, new.fecha_hasta, '[]')
    ) then
      raise exception 'Ya existe una liberación activa que se superpone con ese rango de fechas para esta cochera';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_fixed_spot_releases_no_overlap on public.fixed_spot_releases;
create trigger trg_fixed_spot_releases_no_overlap
  before insert or update on public.fixed_spot_releases
  for each row execute function public.fixed_spot_releases_no_overlap();

-- ---------------------------------------------------------------------
-- Función: indica si una cochera fija está liberada para todo el rango
-- de fechas solicitado (usada por la lógica de reservas para validar
-- que una reserva de un tercero, origen 'fija_liberada', caiga dentro
-- de un rango liberado activo).
-- ---------------------------------------------------------------------
create or replace function public.is_fixed_spot_released(
  p_spot_id uuid,
  p_desde date,
  p_hasta date default null
) returns boolean as $$
  select exists (
    select 1 from public.fixed_spot_releases r
    where r.spot_id = p_spot_id
      and r.estado = 'activa'
      and r.fecha_desde <= p_desde
      and r.fecha_hasta >= coalesce(p_hasta, p_desde)
  );
$$ language sql stable security definer set search_path = public;

grant execute on function public.is_fixed_spot_released(uuid, date, date) to authenticated;

comment on function public.is_fixed_spot_released(uuid, date, date) is
  'true si existe una liberación activa de la cochera p_spot_id que cubre todo el rango [p_desde, p_hasta].';

-- ---------------------------------------------------------------------
-- Vista de conveniencia: estado de liberación "hoy" de cada cochera
-- fija, útil para calcular disponibilidad en el mapa de cocheras sin
-- repetir la lógica de fechas en cada consulta.
-- ---------------------------------------------------------------------
create or replace view public.fixed_spots_release_status as
select
  ps.id as spot_id,
  ps.building_id,
  ps.assigned_user_id,
  public.is_fixed_spot_released(ps.id, current_date) as liberada_hoy
from public.parking_spots ps
where ps.tipo = 'fija';

comment on view public.fixed_spots_release_status is
  'Para cada cochera fija, indica si hoy está liberada (existe una liberación activa que cubre la fecha de hoy).';

-- ---------------------------------------------------------------------
-- Función: el dueño (o un admin) crea una liberación por rango de
-- fechas para su cochera fija.
-- ---------------------------------------------------------------------
create or replace function public.create_fixed_spot_release(
  p_spot_id uuid,
  p_fecha_desde date,
  p_fecha_hasta date,
  p_motivo text default null
) returns public.fixed_spot_releases as $$
declare
  v_spot public.parking_spots;
  v_release public.fixed_spot_releases;
begin
  select * into v_spot from public.parking_spots where id = p_spot_id;

  if v_spot is null then
    raise exception 'Cochera no encontrada';
  end if;

  if v_spot.tipo <> 'fija' then
    raise exception 'Solo se pueden liberar cocheras de tipo fija';
  end if;

  if v_spot.assigned_user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Solo el titular de la cochera fija puede liberarla';
  end if;

  if p_fecha_hasta < p_fecha_desde then
    raise exception 'La fecha hasta no puede ser anterior a la fecha desde';
  end if;

  if p_fecha_desde < current_date then
    raise exception 'La fecha desde no puede estar en el pasado';
  end if;

  insert into public.fixed_spot_releases (spot_id, user_id, fecha_desde, fecha_hasta, motivo, estado)
  values (
    p_spot_id,
    coalesce(v_spot.assigned_user_id, auth.uid()),
    p_fecha_desde,
    p_fecha_hasta,
    p_motivo,
    'activa'
  )
  returning * into v_release;

  return v_release;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.create_fixed_spot_release(uuid, date, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- Función: el dueño (o un admin) cancela una liberación programada o
-- en curso. Las reservas de terceros ya confirmadas dentro del rango
-- NO se cancelan automáticamente (deben gestionarse manualmente si
-- corresponde) — así se evita cancelar reservas de otra persona sin
-- aviso.
-- ---------------------------------------------------------------------
create or replace function public.cancel_fixed_spot_release(p_release_id uuid)
returns public.fixed_spot_releases as $$
declare
  v_release public.fixed_spot_releases;
begin
  select * into v_release from public.fixed_spot_releases where id = p_release_id;

  if v_release is null then
    raise exception 'Liberación no encontrada';
  end if;

  if v_release.user_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Solo el titular puede cancelar esta liberación';
  end if;

  update public.fixed_spot_releases
    set estado = 'cancelada'
    where id = p_release_id
    returning * into v_release;

  return v_release;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.cancel_fixed_spot_release(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Deprecación del modelo anterior (toggle inmediato por estado).
-- Se eliminan las funciones release_fixed_spot / reclaim_fixed_spot de
-- 0002_functions_and_cron.sql: la liberación de una cochera fija ahora
-- se modela exclusivamente con fixed_spot_releases.
-- ---------------------------------------------------------------------
drop function if exists public.release_fixed_spot(uuid);
drop function if exists public.reclaim_fixed_spot(uuid);

-- La policy de 0001 que permitía al titular tocar parking_spots.estado
-- para liberar/tomar su cochera fija ya no es necesaria (el estado base
-- de una cochera fija lo sigue administrando un admin, p. ej. para
-- 'fuera_de_servicio'); la eliminamos para no dejar una vía de escritura
-- sin usar.
drop policy if exists "parking_spots_update_propietario_fija" on public.parking_spots;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.fixed_spot_releases enable row level security;

-- Lectura para cualquier usuario autenticado: es necesaria para poder
-- calcular la disponibilidad de cocheras fijas ajenas en el mapa.
create policy "fixed_spot_releases_select_autenticado" on public.fixed_spot_releases
  for select using (auth.uid() is not null);

-- Alta directa a la tabla (además de la función create_fixed_spot_release,
-- pensada para el flujo normal de la app): solo el propio titular de la
-- cochera fija, o un admin.
create policy "fixed_spot_releases_insert_propietario_o_admin" on public.fixed_spot_releases
  for insert with check (
    public.is_admin() or (
      user_id = auth.uid() and exists (
        select 1 from public.parking_spots ps
        where ps.id = spot_id and ps.assigned_user_id = auth.uid() and ps.tipo = 'fija'
      )
    )
  );

create policy "fixed_spot_releases_update_propietario_o_admin" on public.fixed_spot_releases
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "fixed_spot_releases_delete_admin" on public.fixed_spot_releases
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- Realtime: publicar cambios de fixed_spot_releases (para que el mapa
-- de cocheras se refresque solo cuando alguien libera/cancela).
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.fixed_spot_releases;
  exception when duplicate_object then null;
  end;
end $$;
