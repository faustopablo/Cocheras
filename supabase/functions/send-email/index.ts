// Edge Function: send-email (stub)
//
// Punto de extensión para el envío de emails transaccionales
// (confirmación de reserva, cancelación, liberación por no-show, etc.).
//
// Este MVP NO integra un proveedor real porque no hay credenciales
// disponibles en este entorno. Para activarlo:
//
//   1. Elegir un proveedor (Resend, SendGrid, AWS SES, SMTP genérico).
//   2. Guardar la API key como secreto:
//        supabase secrets set RESEND_API_KEY=xxxxx
//   3. Reemplazar el bloque TODO de abajo por la llamada real, por ej.
//      con Resend:
//
//        const res = await fetch("https://api.resend.com/emails", {
//          method: "POST",
//          headers: {
//            "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
//            "Content-Type": "application/json",
//          },
//          body: JSON.stringify({
//            from: "Cocheras Comafi <cocheras@comafi.com.ar>",
//            to: payload.to,
//            subject: payload.subject,
//            html: payload.html,
//          }),
//        });
//
//   4. Invocar esta función desde otras Edge Functions (ej. complete-past-reservations)
//      o desde server actions de Next.js vía supabase.functions.invoke("send-email", { body: ... }).
//
// Deploy: supabase functions deploy send-email

interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload = (await req.json()) as SendEmailPayload;

  if (!payload?.to || !payload?.subject) {
    return new Response(JSON.stringify({ ok: false, error: "Faltan campos requeridos (to, subject)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // TODO: integrar proveedor real (Resend / SES / SMTP) cuando haya credenciales.
  console.log("[send-email:stub] Se simuló el envío de un email", {
    to: payload.to,
    subject: payload.subject,
  });

  return new Response(
    JSON.stringify({ ok: true, simulated: true, message: "Stub sin proveedor configurado" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
