"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./reservations";

export async function adminCancelReservationAction(reservationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: res } = await supabase
    .from("reservations")
    .select("spot_id, user_id")
    .eq("id", reservationId)
    .single();

  const { error } = await supabase
    .from("reservations")
    .update({ estado: "cancelada" })
    .eq("id", reservationId);

  if (error) return { ok: false, error: "No se pudo cancelar la reserva." };

  if (res?.user_id) {
    await supabase.from("notifications").insert({
      user_id: res.user_id,
      tipo: "reserva_cancelada",
      mensaje: "Un administrador canceló tu reserva.",
    });
  }

  revalidatePath("/admin/reservas");
  revalidatePath("/reservas");
  revalidatePath("/");
  return { ok: true };
}

export async function adminReassignReservationAction(input: {
  reservationId: string;
  newSpotId: string;
}): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("reservations")
    .update({ spot_id: input.newSpotId })
    .eq("id", input.reservationId);

  if (error) {
    return {
      ok: false,
      error: error.message.includes("superpone")
        ? "La cochera destino ya tiene una reserva activa que se superpone."
        : "No se pudo reasignar la reserva.",
    };
  }

  revalidatePath("/admin/reservas");
  return { ok: true };
}
