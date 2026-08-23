-- =====================================================================
-- Cocheras Comafi - Cocheras fijas con múltiples dueños por día de semana
--
-- Reemplaza parking_spots.assigned_user_id (un solo dueño, todos los
-- días) por fixed_spot_assignments: una cochera fija puede tener varias
-- asignaciones, cada una (usuario + conjunto de días ISO de la semana,
-- 1=lunes ... 7=domingo). Los días de la semana sin asignación quedan
-- reservables para cualquier colaborador, como si fueran libres.
--
-- fixed_spot_releases (0003) pasa a liberar por asignación: si un dueño
-- libera un rango de fechas, solo se liberan SUS días dentro de ese
-- rango; los días de otros dueños de la misma cochera no se ven
-- afectados.
--
-- Ejecutar después de 0001/0002/0003 con:
--   supabase db push  (o pegar en el SQL editor del proyecto)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabla fixed_spot_assignments
-- ---------------------------------------------------------------------
create or replace function public.fixed_spot_assignment_dias_validos(p_dias smallint[])
returns boolean as $$
  select
    p_dias is not null
    and coalesce(array_length(p_dias, 1), 0) > 0
    and not exists (select 1 from unnest(p_dias) d where d is null or d < 1 or d > 7)
    and array_length(p_dias, 1) = (select count(*) from (select distinct d from unnest(p_dias) as d) t);
$$ language sql immutable;

comment on function public.fixed_spot_assignment_dias_validos(smallint[]) is
  'true si el arreglo de días ISO (1=lunes..7=domingo) no está vacío, tiene solo valores 1-7 y no tiene duplicados.';

create table if not exists public.fixed_spot_assignments (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.parking_spots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dias smallint[] not null,
  created_at timestamptz not null default now(),
  constraint fixed_spot_assignments_dias_validos check (public.fixed_spot_assignment_dias_validos(dias))
);

comment on table public.fixed_spot_assignments is
  'Asignación de una cochera fija a un usuario para un subconjunto de días de la semana (1=lunes..7=domingo). Una cochera fija puede tener varias asignaciones (distintos dueños en distintos días); los días sin asignación quedan reservables para cualquiera.';

create index if not exists idx_fixed_spot_assignments_spot on public.fixed_spot_assignments (spot_id);
create index if not exists idx_fixed_spot_assignments_user on public.fixed_spot_assignments (user_id);

-- ---------------------------------------------------------------------
-- Trigger: la cochera debe ser de tipo 'fija' y los días no pueden
-- superponerse con otra asignación activa de la misma cochera.
-- ---------------------------------------------------------------------
create or replace function public.fixed_spot_assignments_no_overlap() returns trigger as $$
declare
  v_tipo public.tipo_cochera;
begin
  select tipo into v_tipo from public.parking_spots where id = new.spot_id;

  if v_tipo is null then
    raise exception 'Cochera no encontrada';
  end if;

  if v_tipo <> 'fija' then
    raise exception 'Solo se pueden crear asignaciones para cocheras de tipo fija';
  end if;

  if exists (
    select 1 from public.fixed_spot_assignments a
    where a.spot_id = new.spot_id
      and a.id <> new.id
      and a.dias && new.dias
  ) then
    raise exception 'Ya existe una asignación de esta cochera que ocupa alguno de esos días';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_fixed_spot_assignments_no_overlap on public.fixed_spot_assignments;
create trigger trg_fixed_spot_assignments_no_overlap
  before insert or update on public.fixed_spot_assignments
  for each row execute function public.fixed_spot_assignments_no_overlap();

-- ---------------------------------------------------------------------
-- Migración de datos: cada parking_spots.assigned_user_id no nulo pasa
-- a ser una asignación con los 7 días de la semana (mantiene el
-- comportamiento actual hasta que un admin reparta los días).
-- ---------------------------------------------------------------------
insert into public.fixed_spot_assignments (spot_id, user_id, dias)
select id, assigned_user_id, array[1, 2, 3, 4, 5, 6, 7]::smallint[]
from public.parking_spots
where assigned_user_id is not null;

drop policy if exists "parking_spots_update_propietario_fija" on public.parking_spots;

-- Estos objetos dependen de parking_spots.assigned_user_id y se
-- recrean más abajo ya adaptados al nuevo modelo.
drop view if exists public.fixed_spots_release_status;
drop policy if exists "fixed_spot_releases_insert_propietario_o_admin" on public.fixed_spot_releases;

alter table public.parking_spots drop column if exists assigned_user_id;

-- ---------------------------------------------------------------------
-- fixed_spot_releases: la liberación queda ligada a la asignación (y,
-- por lo tanto, a los días de esa asignación) en lugar de a la cochera
-- entera.
-- ---------------------------------------------------------------------
alter table public.fixed_spot_releases
  add column if not exists assignment_id uuid references public.fixed_spot_assignments (id) on delete cascade;

update public.fixed_spot_releases r
set assignment_id = a.id
from public.fixed_spot_assignments a
where r.assignment_id is null
  and a.spot_id = r.spot_id
  and a.user_id = r.user_id;

-- Cualquier liberación que haya quedado sin asignación correspondiente
-- (no debería pasar dado que 0003 solo permitía liberar cocheras con
-- dueño) se descarta: ya no tiene sentido sin una asignación a la que
-- ligarse.
delete from public.fixed_spot_releases where assignment_id is null;

alter table public.fixed_spot_releases alter column assignment_id set not null;

create index if not exists idx_fixed_spot_releases_assignment on public.fixed_spot_releases (assignment_id);

-- El trigger de superposición ahora valida por asignación (no por
-- cochera): dos dueños distintos de la misma cochera pueden liberar
-- rangos de fechas superpuestos sin problema, porque cada uno libera
-- solo sus propios días. También mantiene spot_id/user_id sincronizados
-- con la asignación para no depender de que el cliente los envíe bien.
create or replace function public.fixed_spot_releases_no_overlap() returns trigger as $$
declare
  v_assignment public.fixed_spot_assignments;
  v_tipo public.tipo_cochera;
begin
  select * into v_assignment from public.fixed_spot_assignments where id = new.assignment_id;

  if v_assignment is null then
    raise exception 'Asignación no encontrada';
  end if;

  select tipo into v_tipo from public.parking_spots where id = v_assignment.spot_id;

  if v_tipo is null or v_tipo <> 'fija' then
    raise exception 'Solo se pueden crear liberaciones para cocheras de tipo fija';
  end if;

  new.spot_id := v_assignment.spot_id;
  new.user_id := v_assignment.user_id;

  if new.estado = 'activa' then
    if exists (
      select 1 from public.fixed_spot_releases r
      where r.assignment_id = new.assignment_id
        and r.estado = 'activa'
        and r.id <> new.id
        and daterange(r.fecha_desde, r.fecha_hasta, '[]') && daterange(new.fecha_desde, new.fecha_hasta, '[]')
    ) then
      raise exception 'Ya existe una liberación activa que se superpone con ese rango de fechas para esta asignación';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- (el trigger trg_fixed_spot_releases_no_overlap creado en 0003 ya
-- apunta a esta función; no hace falta recrearlo)

-- ---------------------------------------------------------------------
-- Función: disponibilidad de una cochera fija para un tercero en un
-- rango [p_desde, p_hasta]. Es "true" solo si TODOS los días del rango
-- están, o bien sin dueño asignado ese día de la semana, o bien
-- liberados por el dueño correspondiente para esa fecha puntual.
-- ---------------------------------------------------------------------
create or replace function public.is_fixed_spot_released(
  p_spot_id uuid,
  p_desde date,
  p_hasta date default null
) returns boolean as $$
  select not exists (
    select 1
    from generate_series(p_desde, coalesce(p_hasta, p_desde), interval '1 day') as gs(dia)
    where exists (
      -- ese día de la semana tiene dueño asignado...
      select 1 from public.fixed_spot_assignments a
      where a.spot_id = p_spot_id
        and extract(isodow from gs.dia)::smallint = any(a.dias)
    )
    and not exists (
      -- ...y ese dueño no liberó justo esa fecha.
      select 1
      from public.fixed_spot_assignments a
      join public.fixed_spot_releases r on r.assignment_id = a.id
      where a.spot_id = p_spot_id
        and extract(isodow from gs.dia)::smallint = any(a.dias)
        and r.estado = 'activa'
        and r.fecha_desde <= gs.dia::date
        and r.fecha_hasta >= gs.dia::date
    )
  );
$$ language sql stable security definer set search_path = public;

comment on function public.is_fixed_spot_released(uuid, date, date) is
  'true si, para cada fecha de [p_desde, p_hasta], el día de la semana no tiene dueño asignado o el dueño de ese día la liberó para esa fecha puntual.';

-- ---------------------------------------------------------------------
-- Vista de conveniencia: para cada cochera fija, quién es su dueño hoy
-- (según el día de la semana) y si hoy está disponible para terceros.
-- ---------------------------------------------------------------------
create or replace view public.fixed_spots_release_status as
select
  ps.id as spot_id,
  ps.building_id,
  (
    select a.user_id
    from public.fixed_spot_assignments a
    where a.spot_id = ps.id
      and extract(isodow from current_date)::smallint = any(a.dias)
    limit 1
  ) as dueno_hoy,
  public.is_fixed_spot_released(ps.id, current_date) as liberada_hoy
from public.parking_spots ps
where ps.tipo = 'fija';

comment on view public.fixed_spots_release_status is
  'Para cada cochera fija: quién es el dueño de hoy (según el día de la semana; null si hoy no tiene dueño) y si hoy está disponible para que la reserve un tercero.';

-- ---------------------------------------------------------------------
-- Función: el dueño de una asignación (o un admin) crea una liberación
-- por rango de fechas. Ahora recibe el id de la asignación en lugar del
-- id de la cochera, porque una misma cochera puede tener varios dueños.
-- ---------------------------------------------------------------------
-- El parámetro cambia de nombre (antes p_spot_id): hay que dropear la
-- versión anterior porque Postgres no permite renombrar parámetros con
-- create or replace function.
drop function if exists public.create_fixed_spot_release(uuid, date, date, text);

create function public.create_fixed_spot_release(
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

  if p_fecha_desde < current_date then
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

grant execute on function public.create_fixed_spot_release(uuid, date, date, text) to authenticated;

comment on function public.create_fixed_spot_release(uuid, date, date, text) is
  'Crea una liberación por rango de fechas para una asignación (dueño + días) de una cochera fija. Solo afecta a los días de esa asignación dentro del rango.';

-- cancel_fixed_spot_release no cambia de firma: sigue identificando la
-- liberación por su propio id y validando contra fixed_spot_releases.user_id
-- (que el trigger mantiene sincronizado con la asignación).

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.fixed_spot_assignments enable row level security;

-- Lectura para cualquier usuario autenticado: necesaria para que
-- cualquiera pueda ver de quién es cada cochera fija cada día y calcular
-- disponibilidad en el mapa.
create policy "fixed_spot_assignments_select_autenticado" on public.fixed_spot_assignments
  for select using (auth.uid() is not null);

-- El ABM de asignaciones (alta/edición/baja) lo hace un admin desde
-- /admin/cocheras.
create policy "fixed_spot_assignments_write_admin" on public.fixed_spot_assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- fixed_spot_releases: el insert directo ahora valida contra la
-- asignación (además de la función create_fixed_spot_release, pensada
-- para el flujo normal de la app).
drop policy if exists "fixed_spot_releases_insert_propietario_o_admin" on public.fixed_spot_releases;
create policy "fixed_spot_releases_insert_propietario_o_admin" on public.fixed_spot_releases
  for insert with check (
    public.is_admin() or (
      user_id = auth.uid() and exists (
        select 1 from public.fixed_spot_assignments a
        where a.id = assignment_id and a.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------
-- Realtime: publicar cambios de fixed_spot_assignments (para que el
-- mapa de cocheras y "Mi cochera fija" se refresquen cuando un admin
-- cambia asignaciones).
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.fixed_spot_assignments;
  exception when duplicate_object then null;
  end;
end $$;
