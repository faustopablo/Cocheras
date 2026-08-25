-- =====================================================================
-- Cocheras Comafi - Ocupación pública del tablero de cocheras
--
-- Bug corregido: la policy "reservations_select_propia_o_admin" (0001)
-- es intencional y correcta (un colaborador no debe poder leer el
-- detalle de la reserva de otro), pero el mapa de cocheras necesita
-- saber qué cocheras están ocupadas por reservas puntuales de OTROS
-- colaboradores para pintar el estado real del día (caso real: Axel
-- reservó la cochera 81 y a Sofía, al no poder leer esa fila por RLS,
-- el mapa le mostraba la 81 como libre; si intentaba reservarla, el
-- trigger `reservations_no_overlap` la rechazaba con un error que no
-- explicaba por qué "estaba libre y no se podía reservar").
--
-- La policy de `reservations` NO se relaja: sigue sin poder leerse el
-- detalle de la reserva ajena (ni la de invitados) directamente. En
-- cambio, se expone el mínimo indispensable de "ocupación" a través de
-- dos vistas security_invoker=off (mismo mecanismo que `owner_names` en
-- 0009: corren con los privilegios del owner de las tablas, que no está
-- sujeto a su RLS por no usar FORCE ROW LEVEL SECURITY):
--
-- 1) `public.active_reservations_board`: spot_id, fecha, estado (siempre
--    'activa': es lo único que expone esta vista, no hace falta
--    devolver la columna), user_id y es_invitado (boolean), de TODAS
--    las reservas en estado 'activa'. No expone canceladas, completadas
--    ni no_show (evita filtrar historial), ni ninguna columna de
--    `guests` (nombre/empresa/patente siguen restringidos a
--    admin/asistente vía la policy de 0008).
--
-- 2) `public.user_display_names`: superconjunto de `owner_names` (0009):
--    user_id + nombre de dueños de cocheras fijas, UNION user_id +
--    nombre de usuarios con al menos una reserva activa. Mismo criterio
--    de privacidad que 0009: solo id+nombre, nada de email/rol/
--    jerarquía, y solo de usuarios efectivamente involucrados en alguna
--    ocupación visible del tablero (no el resto de la nómina del
--    banco). Reemplaza a `owner_names`, que se deja como vista fina
--    (redefinida) por compatibilidad, aunque el código de la app pasa a
--    usar `user_display_names`.
--
-- Criterio elegido para el nombre a mostrar en una cochera ocupada por
-- una reserva puntual (ver app/(protected)/page.tsx y
-- components/spot-card.tsx):
--   - Reserva de un colaborador (user_id no nulo): su nombre, vía
--     `user_display_names`.
--   - Reserva de invitado (guest_id no nulo, user_id nulo): la etiqueta
--     fija "Invitado", sin exponer el nombre del invitado en el mapa
--     (el nombre/empresa/patente del invitado es dato de terceros que
--     hoy solo ven admin/asistente por policy de `guests`; mostrarlo en
--     el mapa a cualquier colaborador ampliaría esa exposición sin
--     necesidad real para decidir si conviene reservar otra cochera).
--     Es la opción más simple y coherente con la política de datos ya
--     definida en 0001/0008.
--
-- Ejecutar después de 0001-0009 con:
--   supabase db push  (o pegar en el SQL editor del proyecto)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. active_reservations_board: ocupación mínima de reservas activas.
-- ---------------------------------------------------------------------
drop view if exists public.active_reservations_board;

create view public.active_reservations_board
  with (security_invoker = false)
as
select
  r.id as reservation_id,
  r.spot_id,
  r.fecha,
  r.estado,
  r.user_id,
  (r.guest_id is not null) as es_invitado
from public.reservations r
where r.estado = 'activa';

comment on view public.active_reservations_board is
  'Ocupación mínima (spot_id, fecha, estado activa, user_id, es_invitado) de TODAS las reservas activas, visible a cualquier usuario autenticado. No expone reservas canceladas/completadas/no_show ni ninguna columna de guests. Vista security_invoker=off (igual que owner_names en 0009): corre con los privilegios del owner de reservations, que no está sujeto a su RLS. Reemplaza, para el tablero de cocheras, a la consulta directa a reservations que la RLS limitaba a "la reserva propia o admin" y hacía que el mapa mostrara como libre una cochera reservada por otro colaborador.';

grant select on public.active_reservations_board to authenticated;

-- No se otorga acceso a `anon`: solo usuarios autenticados del banco.

-- ---------------------------------------------------------------------
-- 2. user_display_names: nombres de dueños de fijas + de usuarios con
--    reserva activa. Reemplaza a owner_names como fuente que usa la app.
-- ---------------------------------------------------------------------
drop view if exists public.user_display_names;

create view public.user_display_names
  with (security_invoker = false)
as
select distinct
  p.id as user_id,
  p.nombre
from public.profiles p
where exists (
  select 1
  from public.fixed_spot_assignments a
  where a.user_id = p.id
) or exists (
  select 1
  from public.reservations r
  where r.user_id = p.id and r.estado = 'activa'
);

comment on view public.user_display_names is
  'Nombre público (id + nombre, sin email/rol/jerarquía) de los usuarios involucrados en alguna ocupación visible del tablero: dueños de cocheras fijas (ver owner_names, 0009) UNION usuarios con al menos una reserva puntual activa. No expone el resto de la nómina del banco. Vista security_invoker=off, mismo mecanismo que owner_names. Usada por el mapa de cocheras para mostrar el nombre de quien ocupa cada cochera (fija o reservada) a TODOS los usuarios.';

grant select on public.user_display_names to authenticated;

-- owner_names (0009) se mantiene por compatibilidad (nadie más además
-- del código de la app la consulta hoy, pero no hace falta romperla):
-- queda como estaba, solo dueños de fijas. El código de la app pasa a
-- usar `user_display_names`, que la incluye como subconjunto.
