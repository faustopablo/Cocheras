-- =====================================================================
-- Cocheras Comafi - Migración inicial
-- Esquema, RLS, triggers y funciones de soporte.
-- Ejecutar con: supabase db push  (o pegar en el SQL editor del proyecto)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensiones necesarias
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
do $$ begin
  create type public.rol_usuario as enum ('admin', 'colaborador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.jerarquia_usuario as enum ('directivo', 'gerente', 'colaborador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_cochera as enum ('fija', 'libre');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_cochera as enum ('libre', 'ocupada', 'bloqueada', 'fuera_de_servicio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.origen_reserva as enum ('fija_liberada', 'libre', 'invitado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_reserva as enum ('activa', 'cancelada', 'completada', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_notificacion as enum (
    'reserva_confirmada', 'reserva_cancelada', 'no_show_liberada',
    'recordatorio', 'cochera_fija_liberada', 'otro'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tabla profiles (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  nombre text not null,
  rol public.rol_usuario not null default 'colaborador',
  jerarquia public.jerarquia_usuario not null default 'colaborador',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_email_dominio_comafi check (email ~* '^[a-zA-Z0-9._%+-]+@comafi\.com\.ar$')
);

comment on table public.profiles is 'Perfil de usuario corporativo. El alta la hace un admin (sin self-signup).';

-- ---------------------------------------------------------------------
-- Edificios, subsuelos y cocheras
-- ---------------------------------------------------------------------
create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  activo boolean not null default true
);

create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  nombre text not null
);

create table if not exists public.parking_spots (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings (id) on delete cascade,
  level_id uuid not null references public.levels (id) on delete cascade,
  codigo text not null,
  tipo public.tipo_cochera not null default 'libre',
  es_prereservada boolean not null default false,
  assigned_user_id uuid references public.profiles (id) on delete set null,
  estado public.estado_cochera not null default 'libre',
  unique (building_id, codigo)
);

create index if not exists idx_parking_spots_level on public.parking_spots (level_id);
create index if not exists idx_parking_spots_building on public.parking_spots (building_id);
create index if not exists idx_parking_spots_assigned_user on public.parking_spots (assigned_user_id);

-- ---------------------------------------------------------------------
-- Invitados (sin DNI, por política de datos del banco)
-- ---------------------------------------------------------------------
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  empresa text,
  patente text not null
);

comment on table public.guests is 'Invitados externos. NO se almacena DNI ni otro dato personal sensible: solo nombre, empresa y patente.';

-- ---------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.parking_spots (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  guest_id uuid references public.guests (id) on delete set null,
  origen public.origen_reserva not null,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz not null,
  estado public.estado_reserva not null default 'activa',
  check_in_at timestamptz,
  check_out_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint reservations_fechas_validas check (fecha_fin > fecha_inicio),
  constraint reservations_titular_check check (
    (origen = 'invitado' and guest_id is not null) or
    (origen <> 'invitado' and user_id is not null)
  )
);

create index if not exists idx_reservations_spot on public.reservations (spot_id);
create index if not exists idx_reservations_user on public.reservations (user_id);
create index if not exists idx_reservations_guest on public.reservations (guest_id);
create index if not exists idx_reservations_estado on public.reservations (estado);
create index if not exists idx_reservations_fecha_inicio on public.reservations (fecha_inicio);

-- Evita superposición de reservas activas para la misma cochera.
create or replace function public.reservations_no_overlap() returns trigger as $$
begin
  if new.estado = 'activa' then
    if exists (
      select 1 from public.reservations r
      where r.spot_id = new.spot_id
        and r.estado = 'activa'
        and r.id <> new.id
        and tstzrange(r.fecha_inicio, r.fecha_fin) && tstzrange(new.fecha_inicio, new.fecha_fin)
    ) then
      raise exception 'La cochera ya tiene una reserva activa que se superpone con ese horario';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_reservations_no_overlap on public.reservations;
create trigger trg_reservations_no_overlap
  before insert or update on public.reservations
  for each row execute function public.reservations_no_overlap();

-- ---------------------------------------------------------------------
-- Reglas de reserva (globales o por edificio)
-- ---------------------------------------------------------------------
create table if not exists public.parking_rules (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references public.buildings (id) on delete cascade,
  dias_max_reserva_futura integer not null default 14,
  horas_max_por_reserva integer not null default 12,
  max_reservas_simultaneas_por_usuario integer not null default 1,
  minutos_tolerancia_no_show integer not null default 30,
  unique (building_id)
);

comment on column public.parking_rules.building_id is 'NULL = regla global (fallback cuando el edificio no tiene regla propia)';

-- ---------------------------------------------------------------------
-- Notificaciones in-app
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo public.tipo_notificacion not null default 'otro',
  mensaje text not null,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, leida);

-- ---------------------------------------------------------------------
-- Trigger: crear profile automáticamente al crear un auth.users
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger as $$
begin
  if new.email !~* '^[a-zA-Z0-9._%+-]+@comafi\.com\.ar$' then
    raise exception 'Solo se permiten altas con email @comafi.com.ar';
  end if;

  insert into public.profiles (id, email, nombre, rol, jerarquia, activo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'rol')::public.rol_usuario, 'colaborador'),
    coalesce((new.raw_user_meta_data ->> 'jerarquia')::public.jerarquia_usuario, 'colaborador'),
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Helper: chequear si el usuario autenticado es admin (evita recursión RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol = 'admin' and p.activo
  );
$$ language sql security definer stable set search_path = public;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.levels enable row level security;
alter table public.parking_spots enable row level security;
alter table public.guests enable row level security;
alter table public.reservations enable row level security;
alter table public.parking_rules enable row level security;
alter table public.notifications enable row level security;

-- profiles ----------------------------------------------------------
create policy "profiles_select_propio_o_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_propio_o_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

create policy "profiles_insert_admin" on public.profiles
  for insert with check (public.is_admin());

create policy "profiles_delete_admin" on public.profiles
  for delete using (public.is_admin());

-- buildings -----------------------------------------------------------
create policy "buildings_select_autenticado" on public.buildings
  for select using (auth.uid() is not null);

create policy "buildings_write_admin" on public.buildings
  for all using (public.is_admin()) with check (public.is_admin());

-- levels ----------------------------------------------------------------
create policy "levels_select_autenticado" on public.levels
  for select using (auth.uid() is not null);

create policy "levels_write_admin" on public.levels
  for all using (public.is_admin()) with check (public.is_admin());

-- parking_spots -----------------------------------------------------------
create policy "parking_spots_select_autenticado" on public.parking_spots
  for select using (auth.uid() is not null);

create policy "parking_spots_write_admin" on public.parking_spots
  for all using (public.is_admin()) with check (public.is_admin());

-- Los usuarios pueden liberar/tomar SU propia cochera fija asignada
-- (cambiar estado) sin ser admin.
create policy "parking_spots_update_propietario_fija" on public.parking_spots
  for update using (assigned_user_id = auth.uid())
  with check (assigned_user_id = auth.uid());

-- guests --------------------------------------------------------------
create policy "guests_select_creador_o_admin" on public.guests
  for select using (
    public.is_admin() or exists (
      select 1 from public.reservations r
      where r.guest_id = guests.id and r.created_by = auth.uid()
    )
  );

create policy "guests_insert_autenticado" on public.guests
  for insert with check (auth.uid() is not null);

create policy "guests_update_creador_o_admin" on public.guests
  for update using (
    public.is_admin() or exists (
      select 1 from public.reservations r
      where r.guest_id = guests.id and r.created_by = auth.uid()
    )
  );

-- reservations ----------------------------------------------------------
create policy "reservations_select_propia_o_admin" on public.reservations
  for select using (
    user_id = auth.uid() or created_by = auth.uid() or public.is_admin()
  );

create policy "reservations_insert_autenticado" on public.reservations
  for insert with check (
    auth.uid() is not null and (created_by = auth.uid() or public.is_admin())
  );

create policy "reservations_update_propia_o_admin" on public.reservations
  for update using (
    user_id = auth.uid() or created_by = auth.uid() or public.is_admin()
  );

create policy "reservations_delete_admin" on public.reservations
  for delete using (public.is_admin());

-- parking_rules ------------------------------------------------------
create policy "parking_rules_select_autenticado" on public.parking_rules
  for select using (auth.uid() is not null);

create policy "parking_rules_write_admin" on public.parking_rules
  for all using (public.is_admin()) with check (public.is_admin());

-- notifications --------------------------------------------------------
create policy "notifications_select_propia_o_admin" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

create policy "notifications_update_propia_o_admin" on public.notifications
  for update using (user_id = auth.uid() or public.is_admin());

create policy "notifications_insert_admin_o_sistema" on public.notifications
  for insert with check (public.is_admin() or user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Realtime: publicar cambios de parking_spots y reservations
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.parking_spots;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.reservations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;
