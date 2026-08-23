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

/** Resultado de proyectar el estado visual de una cochera para una fecha dada. */
export interface SpotDisplayInfo {
  estado: EstadoCochera;
  /** true si la cochera es "mía": la reserva activa es mía, o (si es fija)
   * el dueño asignado ese día de la semana soy yo, esté liberada o no. */
  esMia: boolean;
  /** true específicamente cuando hay una reserva puntual activa y es mía
   * (permite mostrar la hora de fin). */
  esReservaPropia: boolean;
  /** La reserva activa considerada para esta fecha, si corresponde. */
  reservaActiva: Reservation | null;
  /** true si `date` no es hoy: la disponibilidad de reservas puntuales no
   * se proyecta (ver limitación en `computeSpotDisplayForDate`). */
  esProyeccion: boolean;
}

/**
 * Proyecta el estado visual de una cochera para `date` (hoy por defecto),
 * combinando el estado en vivo (hoy) con la disponibilidad fija proyectada
 * (asignaciones por día de semana + liberaciones) para fechas futuras.
 *
 * Límite conocido: para fechas distintas de hoy NO se proyectan reservas
 * puntuales (ni de cocheras `tipo: 'libre'` ni las hechas sobre una fija
 * liberada), porque el modelo actual no permite calcular disponibilidad
 * futura de reservas puntuales de forma económica desde el cliente. Una
 * fecha futura solo refleja quién es el dueño fijo asignado ese día de la
 * semana y si ese dueño la liberó por rango de fechas; no refleja reservas
 * puntuales ya tomadas por otros para ese día futuro.
 */
export function computeSpotDisplayForDate(
  spot: ParkingSpot,
  assignments: FixedSpotAssignment[],
  releases: FixedSpotRelease[],
  activeReservationToday: Reservation | null | undefined,
  currentUserId: string,
  date: Date = new Date()
): SpotDisplayInfo {
  const esHoy = toLocalDateValue(date) === toLocalDateValue(new Date());
  const esProyeccion = !esHoy;

  // Las reservas puntuales solo se consideran para "hoy" (estado en vivo).
  const activeReservation = esHoy ? activeReservationToday ?? null : null;

  const owningAssignment =
    spot.tipo === "fija" ? getOwningAssignmentOnDate(assignments, spot.id, date) : null;
  const isReleasedOnDate =
    spot.tipo === "fija" ? isSpotReleasedOnDate(assignments, releases, spot.id, date) : undefined;

  const estado = computeSpotDisplayStatus(spot, activeReservation, isReleasedOnDate);
  const esReservaPropia = !!activeReservation && activeReservation.user_id === currentUserId;
  const esDuenioFijo = !!owningAssignment && owningAssignment.user_id === currentUserId;
  // "Mía" solo cuenta como tal si hay una reserva puntual propia, o si es
  // mi día fijo Y sigue bloqueado (no lo liberé). Si lo liberé (estado
  // 'libre') o alguien más la reservó (estado 'ocupada' de un tercero), no
  // se pinta como propia aunque yo sea el dueño fijo de ese día.
  const esMia = esReservaPropia || (esDuenioFijo && estado === "bloqueada");

  return {
    estado,
    esMia,
    esReservaPropia,
    reservaActiva: activeReservation,
    esProyeccion,
  };
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
