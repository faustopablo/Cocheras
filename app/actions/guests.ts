"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./reservations";

export async function createGuestReservationAction(input: {
  nombre: string;
  empresa: string;
  patente: string;
  spotId: string;
  /** Fecha (día completo) de la reserva, formato yyyy-MM-dd. */
  fecha: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "No hay sesión activa." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol,activo")
    .eq("id", userData.user.id)
    .single();

  if (!profile || (profile.rol !== "admin" && profile.rol !== "asistente") || !profile.activo) {
    return { ok: false, error: "Solo un administrador o asistente puede gestionar invitados." };
  }

  if (!input.nombre.trim() || !input.patente.trim()) {
    return { ok: false, error: "Nombre y patente son obligatorios." };
  }

  const { data: spot, error: spotError } = await supabase
    .from("parking_spots")
    .select("*")
    .eq("id", input.spotId)
    .single();

  if (spotError || !spot) return { ok: false, error: "Cochera no encontrada." };
  if (spot.estado !== "libre") {
    return { ok: false, error: "La cochera elegida no está disponible en este momento." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    return { ok: false, error: "La fecha ingresada no es válida." };
  }

  const { data: guest, error: guestError } = await supabase
    .from("guests")
    .insert({
      nombre: input.nombre.trim(),
      empresa: input.empresa.trim() || null,
      patente: input.patente.trim().toUpperCase(),
    })
    .select()
    .single();

  if (guestError || !guest) {
    return { ok: false, error: "No se pudo registrar al invitado." };
  }

  const { error: resError } = await supabase.from("reservations").insert({
    spot_id: spot.id,
    guest_id: guest.id,
    origen: "invitado",
    fecha: input.fecha,
    estado: "activa",
    created_by: userData.user.id,
  });

  if (resError) {
    return {
      ok: false,
      error: resError.message.includes("reserva activa para ese día")
        ? "Esa cochera ya tiene una reserva activa para ese día."
        : "No se pudo crear la reserva del invitado.",
    };
  }

  revalidatePath("/invitados");
  revalidatePath("/");
  return { ok: true };
}
