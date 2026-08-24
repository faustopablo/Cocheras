# Cocheras Comafi

MVP de una plataforma de reservas de cocheras corporativas para Banco Comafi
(Argentina). Permite reservar cocheras libres, liberar cocheras fijas por
rango de fechas (ej. vacaciones), gestionar invitados (sin DNI), y
administrar edificios, usuarios, reglas y estadísticas de uso.

## Stack

- **Next.js 16 (App Router, TypeScript)** — desplegable en Vercel.
- **Supabase**: Postgres + RLS + Auth (email/password) + Realtime.
- **Tailwind CSS v4 + componentes propios estilo shadcn/ui.**
- **Recharts** para los KPIs del panel de estadísticas (paleta validada para
  contraste y daltonismo — ver `docs`/comentarios en `components/admin/stats-charts.tsx`).

## Restricción de cumplimiento importante

El modelo de **invitados** es intencionalmente mínimo: `nombre`, `empresa`,
`patente`. **No se solicita ni almacena DNI** ni ningún otro dato personal
sensible de invitados, por política de datos del banco.

## Estructura del repo

```
app/                         # App Router (Next.js)
  login/                     # Login público
  (protected)/               # Rutas que requieren sesión (layout con Navbar)
    page.tsx                 # "/" — mapa de cocheras en vivo
    reservas/                # Mis reservas (cancelar; sin check-in/out)
    invitados/                # Alta de invitados + listado de hoy
    admin/                   # Rutas solo-admin (guard server-side + middleware)
      page.tsx               # Hub de Administración (tarjetas a cada sección)
      edificios/ cocheras/ usuarios/ reservas/ reglas/ estadisticas/
  actions/                   # Server Actions (mutaciones)
components/                  # UI (shadcn-like) + componentes de negocio
lib/                         # Supabase clients, tipos, helpers de auth/stats
proxy.ts                     # Protege rutas y valida rol admin en /admin/* (convención "proxy" de Next 16, ex-middleware.ts)
supabase/
  migrations/                # SQL: esquema, RLS, triggers, funciones
  seed.sql                   # Datos de ejemplo (2 edificios, ~15 cocheras)
  functions/
    complete-past-reservations/  # Edge Function: completa reservas activas de días pasados
    send-email/               # Stub de envío de emails transaccionales
```

## Setup

### 1. Crear el proyecto en Supabase

1. Crear un proyecto nuevo en [supabase.com](https://supabase.com).
2. Copiar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` desde *Project Settings > API*.

### 2. Correr las migraciones

Con la [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref <tu-project-ref>
supabase db push          # aplica supabase/migrations/*.sql
```

O manualmente: pegar el contenido de cada archivo de `supabase/migrations/`
en el SQL Editor del dashboard, en orden numérico (`0001_init.sql`,
`0002_functions_and_cron.sql`, `0003_fixed_spot_releases.sql`,
`0004_fixed_spot_assignments.sql`, `0005_una_cochera_por_dia.sql`,
`0006_sin_checkin.sql`), ya que cada migración asume que las anteriores ya
corrieron.

### 3. Cargar datos de ejemplo (opcional)

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

`supabase/seed.sql` crea 2 edificios, sus subsuelos y ~15 cocheras (mix
fija/libre). Los **usuarios** deben crearse aparte desde Supabase Auth (no se
puede insertar directamente en `auth.users`): usá la pantalla
`/admin/usuarios` de la app (necesita al menos un primer admin) o la CLI:

```bash
supabase auth admin create-user \
  --email admin@comafi.com.ar \
  --password "CambiarEn1erLogin!" \
  --user-metadata '{"nombre":"Admin Cocheras","rol":"admin","jerarquia":"gerente"}'
```

El trigger `on_auth_user_created` crea automáticamente la fila en `profiles`
(y valida que el email sea `@comafi.com.ar`).

### 4. Variables de entorno

```bash
cp .env.example .env.local
```

Completar:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (nunca se expone al cliente; solo la usan las
  Server Actions de `/admin/usuarios`)

### 5. Instalar y correr

```bash
npm install
npm run dev
```

### 6. Deploy a Vercel

1. Importar el repo en Vercel.
2. Configurar las 3 variables de entorno del paso 4 en *Project Settings >
   Environment Variables*.
3. Deploy. No hace falta configuración adicional: el middleware y las Server
   Actions corren en el runtime de Node/Edge de Vercel sin cambios.

## Automatización (Edge Functions + pg_cron)

### Completado automático de reservas pasadas

Una reserva confirmada equivale a check-in automático: no existe una acción
explícita de check-in/check-out ni el concepto de no-show. La función SQL
`public.complete_past_reservations()` (en
`supabase/migrations/0006_sin_checkin.sql`) simplemente marca como
`completada` toda reserva `activa` cuya fecha ya pasó (`fecha < current_date`).
Reemplaza a la antigua `release_no_show_reservations()` (eliminada en esa
misma migración).

Para programarla, habilitá la extensión `pg_cron` (Database > Extensions) y
corré una vez por día (ver comentarios completos en la migración):

```sql
select cron.schedule(
  'complete-past-reservations-sql',
  '5 0 * * *',
  $$ select public.complete_past_reservations(); $$
);
```

También existe la Edge Function `supabase/functions/complete-past-reservations`,
que hace lo mismo invocando la función SQL vía RPC. Deploy:

```bash
supabase functions deploy complete-past-reservations
```

### Envío de emails transaccionales (pendiente de proveedor)

`supabase/functions/send-email` es un **stub**: no hay credenciales de un
proveedor SMTP/Resend en este entorno, así que solo loguea la intención de
envío. Para activarlo:

1. Elegir un proveedor (Resend, SES, SMTP genérico).
2. `supabase secrets set RESEND_API_KEY=...`
3. Reemplazar el bloque `TODO` en `index.ts` por la llamada real al proveedor.
4. Invocar la función desde otras Edge Functions o desde Server Actions con
   `supabase.functions.invoke("send-email", { body: {...} })`.

## Modelo de datos y seguridad

Todo el esquema, los tipos enumerados, los triggers y las políticas de RLS
están documentados con comentarios en `supabase/migrations/0001_init.sql`.
Puntos clave:

- `profiles.email` tiene un `CHECK` que exige dominio `@comafi.com.ar`.
- El trigger `on_auth_user_created` crea el `profile` automáticamente al
  crear un usuario en Auth (alta manual únicamente, sin self-signup).
- RLS: cada usuario ve/edita sus propios datos; `public.is_admin()` (función
  `security definer`) le da bypass a los administradores sin generar
  recursión en las policies.
- **Reservas diarias (no por franja horaria)**
  (`0005_una_cochera_por_dia.sql`): una reserva es una cochera + un día
  completo (columna `reservations.fecha`), no un rango horario.
- **Sin check-in/check-out** (`0006_sin_checkin.sql`): una reserva confirmada
  equivale a check-in automático. No hay acción de check-in/check-out ni
  concepto de no-show; `reservations.check_in_at`/`check_out_at` y
  `parking_rules.hora_limite_checkin` se eliminaron junto con
  `release_no_show_reservations()`. En su lugar, `complete_past_reservations()`
  marca `completada` toda reserva `activa` cuya fecha ya pasó (pensada para
  correr una vez por día vía `pg_cron`, ver sección de Automatización). El
  valor `no_show` sigue existiendo en el enum `estado_reserva` solo por
  compatibilidad con datos históricos; ninguna función ni acción de la app
  vuelve a producirlo.
- **Máximo una cochera por usuario por día** (`0005_una_cochera_por_dia.sql`):
  - Un índice único parcial `uq_reservations_user_fecha_activa` sobre
    `(user_id, fecha)` (solo para `estado = 'activa'` y `user_id` no nulo)
    impide que un colaborador tenga dos reservas activas el mismo día, sin
    importar la cochera. Las reservas de invitados (`guest_id`, `user_id`
    nulo) no cuentan contra este cupo.
  - El trigger `reservations_bloquea_dia_fijo_no_liberado` rechaza una
    reserva puntual si el usuario tiene cochera fija asignada ese día de la
    semana y no la liberó para esa fecha (mensaje: "Ya tenés tu cochera fija
    asignada ese día..."); si la liberó, puede reservar otra cochera ese día
    (ej. va a otro edificio).
  - Al crear/editar una asignación fija (admin), si el usuario ya tiene
    reservas activas futuras en días que pasan a ser fijos, no se bloquea
    (el admin manda): la Server Action devuelve un `warning` con el detalle
    para que el admin decida.
- `reservations` tiene un trigger (`reservations_no_overlap`) que impide dos
  reservas activas para la misma cochera el mismo día.
- **Liberación de cochera fija por rango de fechas** (`0003_fixed_spot_releases.sql`,
  ajustada por `0004_fixed_spot_assignments.sql`): el titular de una
  asignación libera sus días creando una fila en `fixed_spot_releases` con
  `fecha_desde`/`fecha_hasta` (ej. vacaciones), vía la función
  `create_fixed_spot_release` (`security definer`, valida que sea el
  titular de la asignación o un admin). Un trigger
  (`fixed_spot_releases_no_overlap`) impide rangos activos superpuestos
  para la misma asignación (dueños distintos de una misma cochera pueden
  tener rangos superpuestos sin problema, porque cada uno libera solo sus
  propios días). Cancelar una liberación (`cancel_fixed_spot_release`)
  **no** cancela las reservas que terceros ya hayan hecho dentro de ese
  rango.
- **Cocheras fijas con varios dueños por día de semana**
  (`0004_fixed_spot_assignments.sql`): reemplaza
  `parking_spots.assigned_user_id` (un solo dueño, todos los días) por
  `fixed_spot_assignments` (`spot_id`, `user_id`, `dias smallint[]` con
  1=lunes..7=domingo). Una cochera fija puede tener varias asignaciones
  (ej. Juan lunes/miércoles, María martes/jueves); un trigger
  (`fixed_spot_assignments_no_overlap`) impide que dos asignaciones de la
  misma cochera se superpongan en algún día. Los días de la semana sin
  asignación quedan reservables para cualquier colaborador, como si la
  cochera fuera libre esos días. La función
  `is_fixed_spot_released(spot_id, desde, hasta)` (y la vista
  `fixed_spots_release_status` para el estado de "hoy", con el dueño de
  hoy en `dueno_hoy`) determinan si una cochera fija está disponible para
  que la reserve un tercero (origen `fija_liberada`) en un rango dado,
  revisando día por día si no tiene dueño asignado o si el dueño
  correspondiente la liberó para esa fecha puntual; el trigger de reservas
  superpuestas sigue aplicando igual que para cualquier otra cochera.

## Limitaciones conocidas del MVP

- No hay integración real de envío de emails (ver stub arriba) ni de Azure
  AD/SSO — login es email/password de Supabase Auth únicamente.
- El estado "en vivo" de una cochera combina la columna `estado` con las
  reservas activas vigentes y, para cocheras fijas, con si el día de la
  semana de hoy tiene dueño asignado y, si lo tiene, si ese dueño liberó
  hoy (ver `lib/spot-status.ts`, `fixed_spot_assignments` y
  `fixed_spot_releases`) en el momento de la consulta; no hay un job que
  actualice estados al iniciar/finalizar una reserva o liberación
  programada, ya que el cálculo en lectura lo hace innecesario para este
  MVP. Para cocheras fijas, el campo `parking_spots.estado` solo importa
  para marcarlas `fuera_de_servicio`.
- Las estadísticas se calculan en el servidor a partir de datos crudos
  (`lib/stats.ts`) en cada request; para volúmenes grandes convendría
  materializar vistas o agregaciones en SQL.
- No se implementó modo oscuro para los gráficos (la app usa un único tema
  claro).
- Las Edge Functions no fueron desplegadas ni probadas contra un proyecto
  real (no hay credenciales en este entorno), pero el código y el SQL están
  listos para `supabase functions deploy` / `supabase db push`.

## Paleta de marca

- Verde claro: `#01866C`
- Verde oscuro: `#005458`
- Negro verdoso: `#00252F`

Definida como variables CSS en `app/globals.css` (`--comafi-verde-claro`,
`--comafi-verde-oscuro`, `--comafi-negro-verdoso`) y expuesta a Tailwind vía
`@theme inline` (`bg-comafi-verde-claro`, etc.).
