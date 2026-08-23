"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./reservations";
import type { EstadoCochera, TipoCochera } from "@/lib/database.types";

function revalidateAll() {
  revalidatePath("/admin/edificios");
  revalidatePath("/admin/cocheras");
  revalidatePath("/");
}

/**
 * Traduce un error de Supabase/Postgres a un mensaje claro en español.
 * Mapea los casos conocidos (migración faltante, RLS, superposición de
 * días) y, para el resto, devuelve el detalle técnico en lugar de un
 * mensaje genérico que oculte la causa real.
 */
function describeDbError(
  error: { message: string; code?: string },
  accion: string
): string {
  const msg = error.message ?? "";

  if (msg.includes("ocupa alguno de esos días")) {
    return "Alguno de esos días ya está asignado a otro colaborador en esta cochera.";
  }

  if (
    error.code === "42P01" ||
    /relation .* does not exist/i.test(msg) ||
    /schema cache/i.test(msg)
  ) {
    return "La base de datos no tiene aplicada la última migración (0004). Corré `npx supabase db push`.";
  }

  if (
    error.code === "42501" ||
    /permission denied/i.test(msg) ||
    /row-level security/i.test(msg)
  ) {
    return "No tenés permisos de administrador para asignar cocheras.";
  }

  return `No se pudo ${accion}: ${msg}`;
}

export async function createBuildingAction(input: {
  nombre: string;
  direccion: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("buildings").insert({
    nombre: input.nombre.trim(),
    direccion: input.direccion.trim() || null,
  });
  if (error) return { ok: false, error: describeDbError(error, "crear el edificio") };
  revalidateAll();
  return { ok: true };
}

export async function updateBuildingAction(input: {
  id: string;
  nombre: string;
  direccion: string;
  activo: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("buildings")
    .update({ nombre: input.nombre.trim(), direccion: input.direccion.trim() || null, activo: input.activo })
    .eq("id", input.id);
  if (error) return { ok: false, error: describeDbError(error, "actualizar el edificio") };
  revalidateAll();
  return { ok: true };
}

export async function createLevelAction(input: {
  buildingId: string;
  nombre: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("levels")
    .insert({ building_id: input.buildingId, nombre: input.nombre.trim() });
  if (error) return { ok: false, error: describeDbError(error, "crear el subsuelo") };
  revalidateAll();
  return { ok: true };
}

export async function deleteLevelAction(levelId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("levels").delete().eq("id", levelId);
  if (error) return { ok: false, error: describeDbError(error, "eliminar el subsuelo (puede tener cocheras asociadas)") };
  revalidateAll();
  return { ok: true };
}

export async function createSpotAction(input: {
  buildingId: string;
  levelId: string;
  codigo: string;
  tipo: TipoCochera;
  esPrereservada: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("parking_spots").insert({
    building_id: input.buildingId,
    level_id: input.levelId,
    codigo: input.codigo.trim(),
    tipo: input.tipo,
    es_prereservada: input.esPrereservada,
    estado: input.tipo === "fija" ? "bloqueada" : "libre",
  });
  if (error) return { ok: false, error: describeDbError(error, "crear la cochera (verificá que el código no esté repetido)") };
  revalidateAll();
  return { ok: true };
}

export async function updateSpotAction(input: {
  id: string;
  codigo: string;
  tipo: TipoCochera;
  esPrereservada: boolean;
  estado: EstadoCochera;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("parking_spots")
    .update({
      codigo: input.codigo.trim(),
      tipo: input.tipo,
      es_prereservada: input.esPrereservada,
      estado: input.estado,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: describeDbError(error, "actualizar la cochera") };
  revalidateAll();
  return { ok: true };
}

export async function deleteSpotAction(spotId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("parking_spots").delete().eq("id", spotId);
  if (error) return { ok: false, error: describeDbError(error, "eliminar la cochera") };
  revalidateAll();
  return { ok: true };
}

/** Día ISO (1=lunes..7=domingo) de una fecha "yyyy-MM-dd", sin líos de huso horario. */
function isoWeekdayFromFecha(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const js = new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
  return js === 0 ? 7 : js;
}

/**
 * Si el usuario ya tiene reservas activas futuras que caen en alguno de
 * los días que se le están asignando como cochera fija, no bloquea el
 * alta/edición (el admin manda) pero devuelve una advertencia con el
 * detalle para que decida si hay que avisarle o cancelarlas a mano.
 */
async function buildFixedAssignmentWarning(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dias: number[]
): Promise<string | undefined> {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: reservas } = await supabase
    .from("reservations")
    .select("fecha, spot:parking_spots(codigo)")
    .eq("user_id", userId)
    .eq("estado", "activa")
    .gte("fecha", hoy);

  const lista = (reservas ?? []) as unknown as { fecha: string; spot: { codigo: string } | null }[];
  const enConflicto = lista.filter((r) => dias.includes(isoWeekdayFromFecha(r.fecha)));
  if (enConflicto.length === 0) return undefined;

  const detalle = enConflicto
    .map((r) => `${r.fecha}${r.spot?.codigo ? ` (${r.spot.codigo})` : ""}`)
    .join(", ");
  return `El usuario ya tiene ${enConflicto.length} reserva(s) activa(s) que caen en los días asignados: ${detalle}. No se cancelaron automáticamente.`;
}

export async function createFixedSpotAssignmentAction(input: {
  spotId: string;
  userId: string;
  dias: number[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("fixed_spot_assignments").insert({
    spot_id: input.spotId,
    user_id: input.userId,
    dias: input.dias,
  });
  if (error) {
    return { ok: false, error: describeDbError(error, "crear la asignación") };
  }
  revalidateAll();
  const warning = await buildFixedAssignmentWarning(supabase, input.userId, input.dias);
  return { ok: true, warning };
}

export async function updateFixedSpotAssignmentAction(input: {
  id: string;
  userId: string;
  dias: number[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("fixed_spot_assignments")
    .update({ user_id: input.userId, dias: input.dias })
    .eq("id", input.id);
  if (error) {
    return { ok: false, error: describeDbError(error, "actualizar la asignación") };
  }
  revalidateAll();
  const warning = await buildFixedAssignmentWarning(supabase, input.userId, input.dias);
  return { ok: true, warning };
}

export async function deleteFixedSpotAssignmentAction(assignmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("fixed_spot_assignments").delete().eq("id", assignmentId);
  if (error) return { ok: false, error: describeDbError(error, "eliminar la asignación") };
  revalidateAll();
  return { ok: true };
}
