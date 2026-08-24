// Edge Function: complete-past-reservations
//
// Marca como "completada" toda reserva "activa" cuya fecha ya pasó. Ya
// no existe el concepto de check-in/check-out ni de no-show: una
// reserva confirmada equivale a check-in automático, así que solo hace
// falta cerrar (completar) las reservas de días que ya terminaron.
//
// Reemplaza a la antigua Edge Function `release-no-shows`.
//
// Deploy:
//   supabase functions deploy complete-past-reservations
//
// Variables de entorno requeridas (se configuran con `supabase secrets set`):
//   SUPABASE_URL              (se inyecta automáticamente en runtime)
//   SUPABASE_SERVICE_ROLE_KEY (se inyecta automáticamente en runtime)
//
// La lógica de negocio pesada vive en la función SQL
// `public.complete_past_reservations()` (ver
// supabase/migrations/0006_sin_checkin.sql) para poder reusarla también
// desde un cron 100% en SQL sin pasar por esta función.

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase.rpc("complete_past_reservations");

    if (error) {
      console.error("Error completando reservas pasadas:", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const completadas = data ?? [];

    return new Response(
      JSON.stringify({ ok: true, completadas: completadas.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error inesperado en complete-past-reservations:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
