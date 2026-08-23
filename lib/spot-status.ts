import type { EstadoCochera, ParkingSpot, Reservation } from "@/lib/database.types";

/**
 * Calcula el estado "efectivo" de una cochera combinando el estado base
 * (columna `estado`, que administra un admin o las funciones de
 * liberar/tomar fija) con las reservas activas vigentes en este momento.
 * Esto evita tener que correr un cron que actualice `estado` cada vez
 * que arranca/termina una reserva programada.
 */
export function computeSpotDisplayStatus(
  spot: ParkingSpot,
  activeReservation: Reservation | null | undefined
): EstadoCochera {
  if (spot.estado === "fuera_de_servicio") return "fuera_de_servicio";

  if (activeReservation) {
    const now = Date.now();
    const inicio = new Date(activeReservation.fecha_inicio).getTime();
    const fin = new Date(activeReservation.fecha_fin).getTime();
    if (now >= inicio && now <= fin) return "ocupada";
  }

  return spot.estado;
}

export const ESTADO_LABEL: Record<EstadoCochera, string> = {
  libre: "Libre",
  ocupada: "Ocupada",
  bloqueada: "Bloqueada",
  fuera_de_servicio: "Fuera de servicio",
};

export const ESTADO_BADGE_VARIANT: Record<
  EstadoCochera,
  "success" | "destructive" | "warning" | "muted"
> = {
  libre: "success",
  ocupada: "destructive",
  bloqueada: "warning",
  fuera_de_servicio: "muted",
};
