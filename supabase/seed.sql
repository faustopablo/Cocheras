-- =====================================================================
-- Cocheras Comafi - Datos de ejemplo (seed)
-- Emails ficticios @comafi.com.ar, sin datos reales de personas.
--
-- IMPORTANTE: los usuarios de auth.users deben crearse primero desde
-- Supabase Auth (dashboard, `supabase auth admin` o la Admin API que
-- usa /admin/usuarios) para que el trigger on_auth_user_created genere
-- el `profiles` correspondiente. Este seed asume que ya existen y solo
-- ajusta rol/jerarquía; si estás corriendo esto contra una base nueva
-- sin usuarios reales, comentá el bloque de `update public.profiles`
-- y usá los inserts de ejemplo con service role si preferís datos
-- puramente ficticios sin alta de Auth.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Edificios
-- ---------------------------------------------------------------------
insert into public.buildings (id, nombre, direccion, activo) values
  ('11111111-1111-1111-1111-111111111111', 'Casa Central', 'Av. Roque Sáenz Peña 1230, CABA', true),
  ('22222222-2222-2222-2222-222222222222', 'Edificio Catalinas', 'Av. Corrientes 300, CABA', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Subsuelos
-- ---------------------------------------------------------------------
insert into public.levels (id, building_id, nombre) values
  ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Subsuelo 1'),
  ('a2222222-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Subsuelo 2'),
  ('b1111111-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Subsuelo 1')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Reglas globales
-- ---------------------------------------------------------------------
insert into public.parking_rules (building_id, dias_max_reserva_futura, max_reservas_simultaneas_por_usuario, hora_limite_checkin)
values (null, 14, 1, '11:00')
on conflict (building_id) do nothing;

-- ---------------------------------------------------------------------
-- Cocheras (mix fija / libre) - Casa Central, Subsuelo 1
-- ---------------------------------------------------------------------
insert into public.parking_spots (id, building_id, level_id, codigo, tipo, es_prereservada, estado) values
  ('c0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'CC-S1-01', 'fija', true,  'bloqueada'),
  ('c0000001-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'CC-S1-02', 'fija', true,  'bloqueada'),
  ('c0000001-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'CC-S1-03', 'libre', false, 'libre'),
  ('c0000001-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'CC-S1-04', 'libre', false, 'libre'),
  ('c0000001-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'CC-S1-05', 'libre', false, 'fuera_de_servicio')
on conflict (id) do nothing;

-- Casa Central, Subsuelo 2
insert into public.parking_spots (id, building_id, level_id, codigo, tipo, es_prereservada, estado) values
  ('c0000002-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a2222222-1111-1111-1111-111111111111', 'CC-S2-01', 'fija', true,  'bloqueada'),
  ('c0000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a2222222-1111-1111-1111-111111111111', 'CC-S2-02', 'libre', false, 'libre'),
  ('c0000002-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'a2222222-1111-1111-1111-111111111111', 'CC-S2-03', 'libre', false, 'libre'),
  ('c0000002-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'a2222222-1111-1111-1111-111111111111', 'CC-S2-04', 'libre', false, 'bloqueada')
on conflict (id) do nothing;

-- Catalinas, Subsuelo 1
insert into public.parking_spots (id, building_id, level_id, codigo, tipo, es_prereservada, estado) values
  ('c0000003-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'b1111111-2222-2222-2222-222222222222', 'CAT-S1-01', 'fija', true,  'bloqueada'),
  ('c0000003-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'b1111111-2222-2222-2222-222222222222', 'CAT-S1-02', 'libre', false, 'libre'),
  ('c0000003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'b1111111-2222-2222-2222-222222222222', 'CAT-S1-03', 'libre', false, 'libre'),
  ('c0000003-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'b1111111-2222-2222-2222-222222222222', 'CAT-S1-04', 'libre', false, 'libre'),
  ('c0000003-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'b1111111-2222-2222-2222-222222222222', 'CAT-S1-05', 'libre', false, 'ocupada'),
  ('c0000003-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'b1111111-2222-2222-2222-222222222222', 'CAT-S1-06', 'libre', false, 'libre')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Usuarios de ejemplo (ficticios)
--
-- Para que estos usuarios puedan loguearse hace falta crearlos en
-- Supabase Auth (no se puede insertar en auth.users directamente de
-- forma soportada). Sugerencia con la CLI de Supabase o el dashboard:
--
--   supabase auth admin create-user \
--     --email admin@comafi.com.ar --password "CambiarEn1erLogin!" \
--     --user-metadata '{"nombre":"Admin Cocheras","rol":"admin","jerarquia":"gerente"}'
--
-- El trigger on_auth_user_created creará automáticamente la fila en
-- `profiles` leyendo esos metadatos. También podés usar la pantalla
-- /admin/usuarios de la app (usa la Admin API con la service role key).
--
-- Emails sugeridos para pruebas manuales:
--   admin@comafi.com.ar          (rol admin, jerarquia gerente)
--   maria.gomez@comafi.com.ar    (rol colaborador, jerarquia directivo)
--   juan.perez@comafi.com.ar     (rol colaborador, jerarquia gerente)
--   lucia.fernandez@comafi.com.ar(rol colaborador, jerarquia colaborador)
--   carlos.diaz@comafi.com.ar    (rol colaborador, jerarquia colaborador)
-- ---------------------------------------------------------------------

-- Si ya creaste esos usuarios en Auth, podés asignarles cocheras fijas así
-- (reemplazá los UUID por los reales de cada usuario en profiles). Cada
-- asignación es un usuario + un conjunto de días de la semana (1=lunes
-- .. 7=domingo); los días sin asignación quedan libres para cualquiera:
--
-- insert into public.fixed_spot_assignments (spot_id, user_id, dias) values
--   ('c0000001-0000-0000-0000-000000000001', '<uuid-maria>', array[1,2,3,4,5,6,7]);
-- insert into public.fixed_spot_assignments (spot_id, user_id, dias) values
--   ('c0000001-0000-0000-0000-000000000002', '<uuid-juan>', array[1,3]),
--   ('c0000001-0000-0000-0000-000000000002', '<uuid-lucia>', array[2,4]);
