"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ParkingRule } from "@/lib/database.types";

export interface ActionResult {
  ok: boolean;
  error?: string;
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
      horas_max_por_reserva: 12,
      max_reservas_simultaneas_por_usuario: 1,
      minutos_tolerancia_no_show: 30,
    }
  );
}

export async function createReservationAction(input: {
  spotId: string;
  fechaInicio: string;
  fechaFin: string;
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

  const inicio = new Date(input.fechaInicio);
  const fin = new Date(input.fechaFin);
  const ahora = new Date();

  if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin <= inicio) {
    return { ok: false, error: "El rango de fechas ingresado no es válido." };
  }
  if (inicio < new Date(ahora.getTime() - 5 * 60 * 1000)) {
    return { ok: false, error: "La fecha de inicio no puede estar en el pasado." };
  }

  if (spot.tipo === "fija") {
    const inicioFecha = inicio.toISOString().slice(0, 10);
    const finFecha = fin.toISOString().slice(0, 10);
    const { count: liberacionesQueCubren } = await supabase
      .from("fixed_spot_releases")
      .select("id", { count: "exact", head: true })
      .eq("spot_id", spot.id)
      .eq("estado", "activa")
      .lte("fecha_desde", inicioFecha)
      .gte("fecha_hasta", finFecha);

    if (!liberacionesQueCubren) {
      return {
        ok: false,
        error: "Esta cochera fija no fue liberada por su titular para esas fechas.",
      };
    }
  }

  const rule = await getEffectiveRule(spot.building_id);

  const diasAdelante = (inicio.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24);
  if (diasAdelante > rule.dias_max_reserva_futura) {
    return {
      ok: false,
      error: `No se puede reservar con más de ${rule.dias_max_reserva_futura} días de anticipación.`,
    };
  }

  const horasReserva = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
  if (horasReserva > rule.horas_max_por_reserva) {
    return {
      ok: false,
      error: `La reserva no puede durar más de ${rule.horas_max_por_reserva} horas.`,
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
    fecha_inicio: inicio.toISOString(),
    fecha_fin: fin.toISOString(),
    estado: "activa",
    created_by: userData.user.id,
  });

  if (insertError) {
    return { ok: false, error: insertError.message.includes("superpone")
      ? "Ya existe una reserva activa que se superpone con ese horario."
      : "No se pudo crear la reserva. Intentá de nuevo." };
  }

  await supabase.from("notifications").insert({
    user_id: userData.user.id,
    tipo: "reserva_confirmada",
    mensaje: `Reservaste la cochera ${spot.codigo}.`,
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
  spotId: string;
  fechaDesde: string;
  fechaHasta: string;
  motivo?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_fixed_spot_release", {
    p_spot_id: input.spotId,
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
