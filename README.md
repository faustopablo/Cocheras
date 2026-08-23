# Cocheras Comafi

MVP de una plataforma de reservas de cocheras corporativas para Banco Comafi
(Argentina). Permite reservar cocheras libres, liberar/tomar cocheras fijas,
gestionar invitados (sin DNI), y administrar edificios, usuarios, reglas y
estadísticas de uso.

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
    reservas/                # Mis reservas (check-in/out, cancelar)
    invitados/                # Alta de invitados + listado de hoy
    admin/                   # Rutas solo-admin (guard server-side + middleware)
      edificios/ usuarios/ reservas/ reglas/ estadisticas/
  actions/                   # Server Actions (mutaciones)
components/                  # UI (shadcn-like) + componentes de negocio
lib/                         # Supabase clients, tipos, helpers de auth/stats
proxy.ts                     # Protege rutas y valida rol admin en /admin/* (convención "proxy" de Next 16, ex-middleware.ts)
supabase/
  migrations/                # SQL: esquema, RLS, triggers, funciones
  seed.sql                   # Datos de ejemplo (2 edificios, ~15 cocheras)
  functions/
    release-no-shows/        # Edge Function: libera reservas sin check-in
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

O manualmente: pegar el contenido de `supabase/migrations/0001_init.sql` y
luego `0002_functions_and_cron.sql` en el SQL Editor del dashboard, en ese
orden.

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

### Liberación automática de no-shows

La función SQL `public.release_no_show_reservations()` (en
`supabase/migrations/0002_functions_and_cron.sql`) libera las reservas
`activa` sin check-in que superaron `parking_rules.minutos_tolerancia_no_show`,
y crea una notificación in-app.

Para programarla, habilitá las extensiones `pg_cron` y `pg_net` (Database >
Extensions) y corré (ver comentarios completos en la migración):

```sql
select cron.schedule(
  'release-no-shows-sql',
  '*/5 * * * *',
  $$ select public.release_no_show_reservations(); $$
);
```

También existe la Edge Function `supabase/functions/release-no-shows`, que
hace lo mismo invocando la función SQL vía RPC — útil si en el futuro querés
disparar además el envío de un email desde ahí. Deploy:

```bash
supabase functions deploy release-no-shows
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
- `reservations` tiene un trigger que impide dos reservas activas
  superpuestas sobre la misma cochera.
- `release_fixed_spot` / `reclaim_fixed_spot` son funciones `security
  definer` que garantizan que solo el titular de una cochera fija pueda
  liberarla o retomarla (y al retomarla, cancelan cualquier reserva de un
  tercero sobre esa cochera).

## Limitaciones conocidas del MVP

- No hay integración real de envío de emails (ver stub arriba) ni de Azure
  AD/SSO — login es email/password de Supabase Auth únicamente.
- El estado "en vivo" de una cochera combina la columna `estado` con las
  reservas activas vigentes en el momento de la consulta (ver
  `lib/spot-status.ts`); no hay un job que mueva `parking_spots.estado` al
  iniciar/finalizar una reserva programada, ya que el cálculo en lectura lo
  hace innecesario para este MVP.
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
