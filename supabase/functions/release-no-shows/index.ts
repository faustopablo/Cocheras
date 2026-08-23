// Edge Function: release-no-shows
//
// Libera reservas activas sin check-in que superaron la tolerancia
// configurada en `parking_rules` y crea una notificación in-app.
// Pensada para ser invocada periódicamente por pg_cron + pg_net (ver
// supabase/migrations/0002_functions_and_cron.sql) o por un Supabase
// Scheduled Trigger.
//
// Deploy:
//   supabase functions deploy release-no-shows
//
// Variables de entorno requeridas (se configuran con `supabase secrets set`):
//   SUPABASE_URL              (se inyecta automáticamente en runtime)
//   SUPABASE_SERVICE_ROLE_KEY (se inyecta automáticamente en runtime)
//
// La lógica de negocio pesada vive en la función SQL
// `public.release_no_show_reservations()` para poder reusarla también
// desde un cron 100% en SQL sin pasar por esta función.

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase.rpc("release_no_show_reservations");

    if (error) {
      console.error("Error liberando no-shows:", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const liberadas = data ?? [];

    // Punto de extensión: acá se podría llamar a la Edge Function
    // `send-email` (o directamente a un proveedor SMTP/Resend) para
    // avisar por mail a cada usuario afectado. Ver supabase/functions/send-email.
    // for (const reserva of liberadas) {
    //   await fetch(`${supabaseUrl}/functions/v1/send-email`, { ... })
    // }

    return new Response(
      JSON.stringify({ ok: true, liberadas: liberadas.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error inesperado en release-no-shows:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
