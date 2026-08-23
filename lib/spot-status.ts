import type { EstadoCochera, FixedSpotRelease, ParkingSpot, Reservation } from "@/lib/database.types";
import { toLocalDateValue } from "@/lib/utils";

/**
 * true si, dentro de las liberaciones activas provistas, hay alguna para
 * `spotId` cuyo rango [fecha_desde, fecha_hasta] cubre `date` (hoy por
 * defecto). Pensado para listas ya filtradas por `estado = 'activa'`.
 */
export function isSpotReleasedOnDate(
  releases: FixedSpotRelease[],
  spotId: string,
  date: Date = new Date()
): boolean {
  const target = toLocalDateValue(date);
  return releases.some(
    (r) =>
      r.spot_id === spotId &&
      r.estado === "activa" &&
      r.fecha_desde <= target &&
      r.fecha_hasta >= target
  );
}

/**
 * Calcula el estado "efectivo" de una cochera combinando el estado base
 * (columna `estado`, que administra un admin, p. ej. para
 * 'fuera_de_servicio') con las reservas activas vigentes en este momento
 * y, para cocheras fijas, con si hoy existe una liberación por rango de
 * fechas activa (ver `fixed_spot_releases`). Esto evita tener que correr
 * un cron que actualice `estado` cada vez que arranca/termina una reserva
 * programada o una liberación.
 *
 * `isReleasedToday` solo aplica a cocheras `tipo: 'fija'`: indica si hoy
 * cae dentro de un rango liberado activo para esa cochera.
 */
export function computeSpotDisplayStatus(
  spot: ParkingSpot,
  activeReservation: Reservation | null | undefined,
  isReleasedToday?: boolean
): EstadoCochera {
  if (spot.estado === "fuera_de_servicio") return "fuera_de_servicio";

  if (activeReservation) {
    const now = Date.now();
    const inicio = new Date(activeReservation.fecha_inicio).getTime();
    const fin = new Date(activeReservation.fecha_fin).getTime();
    if (now >= inicio && now <= fin) return "ocupada";
  }

  if (spot.tipo === "fija") {
    return isReleasedToday ? "libre" : "bloqueada";
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
