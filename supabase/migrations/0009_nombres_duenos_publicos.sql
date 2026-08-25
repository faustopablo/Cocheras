-- =====================================================================
-- Cocheras Comafi - Nombres de dueños de cocheras fijas visibles para
-- todos los usuarios autenticados (no solo admin).
--
-- Contexto: la policy "profiles_select_propio_o_admin" (0001) es
-- intencional y correcta: un colaborador no debe poder leer el perfil
-- completo de otro (email, rol, jerarquía) de otro usuario. Pero el
-- mapa de cocheras necesita mostrar "de quién es" cada cochera fija a
-- CUALQUIER usuario, no solo al admin.
--
-- Solución: una vista `public.owner_names` que expone únicamente
-- `user_id` + `nombre` (nada de email/rol/jerarquía) y SOLO de
-- usuarios que efectivamente son dueños de alguna cochera fija (tienen
-- al menos una fila en fixed_spot_assignments). No expone el resto de
-- los usuarios del banco.
--
-- Cómo evita la RLS de profiles de forma controlada: una vista en
-- Postgres se ejecuta, por defecto, con los privilegios de su DUEÑO
-- (no de quien la consulta) — a diferencia de una tabla, donde rige
-- siempre el usuario que consulta. Esta migración corre como el rol
-- propietario de `profiles` (el mismo que aplica las migraciones,
-- p. ej. `postgres`), que además es owner de la tabla y por lo tanto
-- no está sujeto a sus policies de RLS (el owner de una tabla nunca
-- queda sujeto a RLS salvo que se use FORCE ROW LEVEL SECURITY, que
-- esta app no usa). Por eso alcanza con dejar `security_invoker = off`
-- (el valor por defecto desde Postgres 15) en la vista: NO hace falta
-- una función security definer aparte. Se deja explícito en el DDL
-- para que la decisión quede documentada y no dependa de un default
-- implícito que alguien podría cambiar sin darse cuenta.
--
-- La vista en sí NO tiene (ni necesita) RLS propia: lo que protege el
-- acceso es que solo expone dos columnas y solo filas de dueños. El
-- grant de select se otorga a `authenticated` (no a `anon`).
--
-- Ejecutar después de 0001-0008 con:
--   supabase db push  (o pegar en el SQL editor del proyecto)
-- =====================================================================

drop view if exists public.owner_names;

create view public.owner_names
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
);

comment on view public.owner_names is
  'Nombre público (id + nombre, sin email/rol/jerarquía) de los usuarios que son dueños de al menos una cochera fija. Vista security_invoker=off: se ejecuta con los privilegios del owner de profiles (que no está sujeto a su RLS), para exponer de forma controlada solo estos dos campos a cualquier usuario autenticado. Usada por el mapa de cocheras para mostrar el nombre del dueño del día en las cocheras fijas a TODOS los usuarios (no solo admin).';

grant select on public.owner_names to authenticated;

-- No se otorga acceso a `anon`: solo usuarios autenticados del banco
-- pueden ver estos nombres.
