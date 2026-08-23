"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./reservations";
import type { EstadoCochera, TipoCochera } from "@/lib/database.types";

function revalidateAll() {
  revalidatePath("/admin/edificios");
  revalidatePath("/");
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
  if (error) return { ok: false, error: "No se pudo crear el edificio." };
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
  if (error) return { ok: false, error: "No se pudo actualizar el edificio." };
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
  if (error) return { ok: false, error: "No se pudo crear el subsuelo." };
  revalidateAll();
  return { ok: true };
}

export async function deleteLevelAction(levelId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("levels").delete().eq("id", levelId);
  if (error) return { ok: false, error: "No se pudo eliminar el subsuelo (puede tener cocheras asociadas)." };
  revalidateAll();
  return { ok: true };
}

export async function createSpotAction(input: {
  buildingId: string;
  levelId: string;
  codigo: string;
  tipo: TipoCochera;
  esPrereservada: boolean;
  assignedUserId: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("parking_spots").insert({
    building_id: input.buildingId,
    level_id: input.levelId,
    codigo: input.codigo.trim(),
    tipo: input.tipo,
    es_prereservada: input.esPrereservada,
    assigned_user_id: input.assignedUserId,
    estado: input.tipo === "fija" ? "bloqueada" : "libre",
  });
  if (error) return { ok: false, error: "No se pudo crear la cochera (verificá que el código no esté repetido)." };
  revalidateAll();
  return { ok: true };
}

export async function updateSpotAction(input: {
  id: string;
  codigo: string;
  tipo: TipoCochera;
  esPrereservada: boolean;
  assignedUserId: string | null;
  estado: EstadoCochera;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("parking_spots")
    .update({
      codigo: input.codigo.trim(),
      tipo: input.tipo,
      es_prereservada: input.esPrereservada,
      assigned_user_id: input.assignedUserId,
      estado: input.estado,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: "No se pudo actualizar la cochera." };
  revalidateAll();
  return { ok: true };
}

export async function deleteSpotAction(spotId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("parking_spots").delete().eq("id", spotId);
  if (error) return { ok: false, error: "No se pudo eliminar la cochera." };
  revalidateAll();
  return { ok: true };
}
