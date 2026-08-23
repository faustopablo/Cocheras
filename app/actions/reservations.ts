"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ParkingRule } from "@/lib/database.types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Advertencia no bloqueante (ej. asignar una cochera fija sobre días con reservas futuras). */
  warning?: string;
}

/**
 * Traduce los mensajes de excepción de los triggers de `reservations`
 * (ver `supabase/migrations/0005_una_cochera_por_dia.sql`) a mensajes
 * claros en español.
 */
function describeReservationError(error: { message: string; code?: string }): string {
  const msg = error.message ?? "";

  if (msg.includes("cochera fija asignada ese día")) {
    return "Ya tenés tu cochera fija asignada ese día. Si no la vas a usar, liberala primero.";
  }
  if (error.code === "23505" || msg.includes("uq_reservations_user_fecha_activa")) {
    return "Ya tenés una reserva activa ese día. No podés tener más de una cochera el mismo día.";
  }
  if (msg.includes("reserva activa para ese día")) {
    return "Esa cochera ya tiene una reserva activa para ese día.";
  }
  return "No se pudo crear la reserva. Intentá de nuevo.";
}

async function getEffectiveRule(buildingId: string): Promise<ParkingRule> {
  const supabase = await createClient();

  const { data: buildingRule } = await supabase
    .from("parking_rules")
    .select("*")
    .eq("building_id", buildingId)
    .maybeSingle();

  if (buildingRule) return buildingRule as ParkingRule;

  const { data: globalRule } = await supabase
    .from("parking_rules")
    .select("*")
    .is("building_id", null)
    .maybeSingle();

  return (
    (globalRule as ParkingRule) ?? {
      id: "default",
      building_id: null,
      dias_max_reserva_futura: 14,
      max_reservas_simultaneas_por_usuario: 1,
      hora_limite_checkin: "11:00",
    }
  );
}

export async function createReservationAction(input: {
  spotId: string;
  /** Fecha (día completo) a reservar, formato yyyy-MM-dd. */
  fecha: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "No hay sesión activa." };

  const { data: spot, error: spotError } = await supabase
    .from("parking_spots")
    .select("*")
    .eq("id", input.spotId)
    .single();

  if (spotError || !spot) return { ok: false, error: "Cochera no encontrada." };
  if (spot.estado === "fuera_de_servicio") {
    return { ok: false, error: "Esta cochera está fuera de servicio." };
  }
  if (spot.tipo === "libre" && spot.estado === "bloqueada") {
    return { ok: false, error: "Esta cochera está bloqueada por administración." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    return { ok: false, error: "La fecha ingresada no es válida." };
  }

  const hoy = new Date();
  const hoyFecha = hoy.toISOString().slice(0, 10);
  if (input.fecha < hoyFecha) {
    return { ok: false, error: "No podés reservar para una fecha pasada." };
  }

  if (spot.tipo === "fija") {
    // Disponible si ese día de la semana no tiene dueño asignado o el
    // dueño correspondiente la liberó.
    const { data: disponible, error: disponibleError } = await supabase.rpc(
      "is_fixed_spot_released",
      { p_spot_id: spot.id, p_desde: input.fecha, p_hasta: input.fecha }
    );

    if (disponibleError || !disponible) {
      return {
        ok: false,
        error: "Esta cochera fija tiene dueño ese día y no fue liberada para esa fecha.",
      };
    }
  }

  const rule = await getEffectiveRule(spot.building_id);

  const diasAdelante =
    (new Date(input.fecha).getTime() - new Date(hoyFecha).getTime()) / (1000 * 60 * 60 * 24);
  if (diasAdelante > rule.dias_max_reserva_futura) {
    return {
      ok: false,
      error: `No se puede reservar con más de ${rule.dias_max_reserva_futura} días de anticipación.`,
    };
  }

  const { count } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userData.user.id)
    .eq("estado", "activa");

  if ((count ?? 0) >= rule.max_reservas_simultaneas_por_usuario) {
    return {
      ok: false,
      error: `Ya alcanzaste el máximo de ${rule.max_reservas_simultaneas_por_usuario} reserva(s) simultánea(s) permitidas.`,
    };
  }

  const origen = spot.tipo === "fija" ? "fija_liberada" : "libre";

  const { error: insertError } = await supabase.from("reservations").insert({
    spot_id: spot.id,
    user_id: userData.user.id,
    origen,
    fecha: input.fecha,
    estado: "activa",
    created_by: userData.user.id,
  });

  if (insertError) {
    return { ok: false, error: describeReservationError(insertError) };
  }

  await supabase.from("notifications").insert({
    user_id: userData.user.id,
    tipo: "reserva_confirmada",
    mensaje: `Reservaste la cochera ${spot.codigo} para el ${input.fecha}.`,
  });

  revalidatePath("/");
  revalidatePath("/reservas");
  return { ok: true };
}

export async function cancelReservationAction(reservationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "No hay sesión activa." };

  const { error } = await supabase
    .from("reservations")
    .update({ estado: "cancelada" })
    .eq("id", reservationId);

  if (error) return { ok: false, error: "No se pudo cancelar la reserva." };

  revalidatePath("/");
  revalidatePath("/reservas");
  revalidatePath("/admin/reservas");
  return { ok: true };
}

export async function checkInAction(reservationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ check_in_at: new Date().toISOString() })
    .eq("id", reservationId);

  if (error) return { ok: false, error: "No se pudo registrar el check-in." };

  revalidatePath("/reservas");
  return { ok: true };
}

export async function checkOutAction(reservationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reservations")
    .update({ check_out_at: new Date().toISOString(), estado: "completada" })
    .eq("id", reservationId);

  if (error) return { ok: false, error: "No se pudo registrar el check-out." };

  revalidatePath("/reservas");
  return { ok: true };
}

export async function createFixedSpotReleaseAction(input: {
  assignmentId: string;
  fechaDesde: string;
  fechaHasta: string;
  motivo?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_fixed_spot_release", {
    p_assignment_id: input.assignmentId,
    p_fecha_desde: input.fechaDesde,
    p_fecha_hasta: input.fechaHasta,
    p_motivo: input.motivo?.trim() || null,
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("superpone")
        ? "Ya existe una liberación activa que se superpone con esas fechas."
        : error.message,
    };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function cancelFixedSpotReleaseAction(releaseId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_fixed_spot_release", { p_release_id: releaseId });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}
