"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./reservations";

export async function createGuestReservationAction(input: {
  nombre: string;
  empresa: string;
  patente: string;
  spotId: string;
  fechaInicio: string;
  fechaFin: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "No hay sesión activa." };

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

  const inicio = new Date(input.fechaInicio);
  const fin = new Date(input.fechaFin);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin <= inicio) {
    return { ok: false, error: "El rango de fechas ingresado no es válido." };
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
    fecha_inicio: inicio.toISOString(),
    fecha_fin: fin.toISOString(),
    estado: "activa",
    created_by: userData.user.id,
  });

  if (resError) {
    return {
      ok: false,
      error: resError.message.includes("superpone")
        ? "Ya existe una reserva activa que se superpone con ese horario."
        : "No se pudo crear la reserva del invitado.",
    };
  }

  revalidatePath("/invitados");
  revalidatePath("/");
  return { ok: true };
}
