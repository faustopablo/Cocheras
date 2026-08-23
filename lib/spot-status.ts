import type {
  EstadoCochera,
  FixedSpotAssignment,
  FixedSpotRelease,
  ParkingSpot,
  Reservation,
} from "@/lib/database.types";
import { isoWeekday, toLocalDateValue } from "@/lib/utils";

/**
 * Asignación (si existe) que es dueña de `spotId` para el día de la
 * semana de `date` (hoy por defecto). `null` si ese día de la semana no
 * tiene dueño asignado, en cuyo caso la cochera queda reservable para
 * cualquiera.
 */
export function getOwningAssignmentOnDate(
  assignments: FixedSpotAssignment[],
  spotId: string,
  date: Date = new Date()
): FixedSpotAssignment | null {
  const dow = isoWeekday(date);
  return (
    assignments.find((a) => a.spot_id === spotId && a.dias.includes(dow)) ?? null
  );
}

/**
 * true si, para el día de la semana de `date` (hoy por defecto), la
 * cochera `spotId` está disponible para que la reserve un tercero: no
 * tiene dueño asignado ese día, o el dueño de ese día la liberó
 * mediante una liberación activa que cubre `date`. Pensado para listas
 * ya filtradas por `estado = 'activa'`.
 */
export function isSpotReleasedOnDate(
  assignments: FixedSpotAssignment[],
  releases: FixedSpotRelease[],
  spotId: string,
  date: Date = new Date()
): boolean {
  const asignacion = getOwningAssignmentOnDate(assignments, spotId, date);
  if (!asignacion) return true;

  const target = toLocalDateValue(date);
  return releases.some(
    (r) =>
      r.assignment_id === asignacion.id &&
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
