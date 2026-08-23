"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./reservations";

export async function upsertRuleAction(input: {
  buildingId: string | null;
  diasMaxReservaFutura: number;
  horasMaxPorReserva: number;
  maxReservasSimultaneasPorUsuario: number;
  minutosToleranciaNoShow: number;
}): Promise<ActionResult> {
  const supabase = await createClient();

  const payload = {
    building_id: input.buildingId,
    dias_max_reserva_futura: input.diasMaxReservaFutura,
    horas_max_por_reserva: input.horasMaxPorReserva,
    max_reservas_simultaneas_por_usuario: input.maxReservasSimultaneasPorUsuario,
    minutos_tolerancia_no_show: input.minutosToleranciaNoShow,
  };

  // Postgres no considera NULL == NULL para el constraint UNIQUE(building_id),
  // así que el upsert automático no detecta conflicto para la regla global.
  // Por eso resolvemos manualmente si hay que insertar o actualizar.
  let existingQuery = supabase.from("parking_rules").select("id");
  existingQuery =
    input.buildingId === null
      ? existingQuery.is("building_id", null)
      : existingQuery.eq("building_id", input.buildingId);
  const { data: existing } = await existingQuery.maybeSingle();

  const { error } = existing
    ? await supabase.from("parking_rules").update(payload).eq("id", existing.id)
    : await supabase.from("parking_rules").insert(payload);

  if (error) return { ok: false, error: "No se pudo guardar la regla." };

  revalidatePath("/admin/reglas");
  return { ok: true };
}

export async function deleteRuleAction(ruleId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("parking_rules").delete().eq("id", ruleId);
  if (error) return { ok: false, error: "No se pudo eliminar la regla." };
  revalidatePath("/admin/reglas");
  return { ok: true };
}
