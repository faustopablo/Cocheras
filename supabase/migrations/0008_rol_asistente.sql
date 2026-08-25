-- =====================================================================
-- Cocheras Comafi - Rol "asistente"
--
-- Contexto: hoy cualquier "colaborador" autenticado puede dar de alta
-- invitados y reservas de invitados. Se introduce un tercer rol,
-- "asistente", que es el único (junto con "admin") habilitado para
-- gestionar /invitados. El "colaborador" pierde ese acceso pero
-- mantiene todo lo demás sin cambios (reservar su propia cochera, etc).
--
-- Nota de diseño sobre el tipo de `profiles.rol`:
-- `rol_usuario` se creó en 0001 como `enum`. Postgres no permite usar
-- un valor agregado con `alter type ... add value` dentro de la misma
-- transacción en la que se agregó (error 55P04), y `supabase db push`
-- aplica cada archivo de migración dentro de una transacción. Agregar
-- el valor y usarlo en política/función en el mismo archivo rompería
-- el push. En vez de fragmentar esta migración en múltiples pushes (o
-- depender de que nadie corra esto con `--dry-run`/en una transacción
-- explícita), se convierte la columna a `text` + `check constraint`:
-- mismo comportamiento, sin la restricción transaccional del enum, y
-- más fácil de extender a futuro si aparecen más roles. El tipo
-- `rol_usuario` en sí no se borra (podría estar referenciado fuera de
-- este repo); simplemente deja de usarse en `profiles.rol`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles.rol: enum -> text + check constraint (incluye 'asistente')
-- ---------------------------------------------------------------------
alter table public.profiles alter column rol drop default;
alter table public.profiles alter column rol type text using rol::text;
alter table public.profiles alter column rol set default 'colaborador';

alter table public.profiles
  add constraint profiles_rol_check
  check (rol in ('admin', 'asistente', 'colaborador'));

comment on column public.profiles.rol is
  'admin: acceso total. asistente: igual que colaborador + gestión de /invitados. colaborador: uso normal (reservar su propia cochera), sin acceso a /invitados.';

-- ---------------------------------------------------------------------
-- 2. handle_new_user(): ya no castea a public.rol_usuario (la columna
--    ahora es text). El check constraint de arriba sigue validando el
--    valor en el insert.
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
    coalesce(new.raw_user_meta_data ->> 'rol', 'colaborador'),
    coalesce((new.raw_user_meta_data ->> 'jerarquia')::public.jerarquia_usuario, 'colaborador'),
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------
-- 3. Helper: admin o asistente (evita recursión RLS, igual que is_admin()).
-- ---------------------------------------------------------------------
create or replace function public.is_admin_or_asistente() returns boolean as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.rol in ('admin', 'asistente') and p.activo
  );
$$ language sql security definer stable set search_path = public;

comment on function public.is_admin_or_asistente() is
  'true si el usuario autenticado es admin o asistente (los dos roles con acceso a /invitados).';

-- ---------------------------------------------------------------------
-- 4. RLS: guests. Antes cualquier autenticado podía insertar/editar y
--    ver los invitados que había creado; ahora solo admin/asistente
--    (el colaborador común no necesita ver ni gestionar invitados).
-- ---------------------------------------------------------------------
drop policy if exists "guests_select_creador_o_admin" on public.guests;
drop policy if exists "guests_insert_autenticado" on public.guests;
drop policy if exists "guests_update_creador_o_admin" on public.guests;

create policy "guests_select_admin_o_asistente" on public.guests
  for select using (public.is_admin_or_asistente());

create policy "guests_insert_admin_o_asistente" on public.guests
  for insert with check (public.is_admin_or_asistente());

create policy "guests_update_admin_o_asistente" on public.guests
  for update using (public.is_admin_or_asistente())
  with check (public.is_admin_or_asistente());

-- ---------------------------------------------------------------------
-- 5. RLS: reservations. Se agrega la restricción admin/asistente para
--    las reservas de invitados (origen = 'invitado'); el resto del
--    comportamiento (reservar la cochera propia, ver/editar lo propio)
--    queda igual.
-- ---------------------------------------------------------------------
drop policy if exists "reservations_insert_autenticado" on public.reservations;
drop policy if exists "reservations_update_propia_o_admin" on public.reservations;

create policy "reservations_insert_autenticado" on public.reservations
  for insert with check (
    auth.uid() is not null
    and (created_by = auth.uid() or public.is_admin())
    and (origen <> 'invitado' or public.is_admin_or_asistente())
  );

create policy "reservations_update_propia_o_admin" on public.reservations
  for update using (
    (user_id = auth.uid() or created_by = auth.uid() or public.is_admin())
    and (origen <> 'invitado' or public.is_admin_or_asistente())
  );
