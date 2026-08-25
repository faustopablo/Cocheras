import type {
  ActiveReservationBoardRow,
  EstadoCochera,
  FixedSpotAssignment,
  FixedSpotRelease,
  ParkingSpot,
} from "@/lib/database.types";
import { hoyArgentina, hoyArgentinaDate, isoWeekday, toLocalDateValue } from "@/lib/utils";

/**
 * Asignación (si existe) que es dueña de `spotId` para el día de la
 * semana de `date` (hoy por defecto). `null` si ese día de la semana no
 * tiene dueño asignado, en cuyo caso la cochera queda reservable para
 * cualquiera.
 */
export function getOwningAssignmentOnDate(
  assignments: FixedSpotAssignment[],
  spotId: string,
  date: Date = hoyArgentinaDate()
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
  date: Date = hoyArgentinaDate()
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
 * 'fuera_de_servicio') con si hay una reserva activa para la fecha vista
 * y, para cocheras fijas, con si esa fecha cae dentro de un rango
 * liberado activo (ver `fixed_spot_releases`). Esto evita tener que
 * correr un cron que actualice `estado` cada vez que se crea/cancela una
 * reserva o una liberación.
 *
 * Las reservas son diarias (una reserva = una cochera + un día), así que
 * `activeReservation` ya debe corresponder exactamente a la fecha que se
 * está proyectando (ver `computeSpotDisplayForDate`).
 */
/**
 * Estado visual de una cochera. Extiende `EstadoCochera` (la columna
 * `estado` de la base, que administra un admin) con `"asignada"`: una
 * cochera fija con dueño asignado el día visto, que ese dueño no liberó
 * y sobre la que nadie tiene una reserva activa. Se distingue de
 * `"ocupada"`, que implica que alguien tiene una reserva activa para ese
 * día.
 */
export type SpotDisplayEstado = EstadoCochera | "asignada";

export function computeSpotDisplayStatus(
  spot: ParkingSpot,
  activeReservation: ActiveReservationBoardRow | null | undefined,
  isReleasedOnDate?: boolean
): SpotDisplayEstado {
  if (spot.estado === "fuera_de_servicio") return "fuera_de_servicio";

  if (activeReservation) return "ocupada";

  if (spot.tipo === "fija") {
    // Nadie tiene una reserva activa: si no se liberó, está "asignada" a
    // su dueño de ese día (no "ocupada": eso se reserva para cuando hay
    // una reserva puntual sobre la cochera).
    return isReleasedOnDate ? "libre" : "asignada";
  }

  return spot.estado;
}

/** Resultado de proyectar el estado visual de una cochera para una fecha dada. */
export interface SpotDisplayInfo {
  estado: SpotDisplayEstado;
  /** true si la cochera es "mía": la reserva activa ese día es mía, o (si
   * es fija) el dueño asignado ese día de la semana soy yo, esté liberada
   * o no. */
  esMia: boolean;
  /** true específicamente cuando hay una reserva puntual activa ese día y
   * es mía. */
  esReservaPropia: boolean;
  /** La reserva activa considerada para esta fecha, si corresponde. */
  reservaActiva: ActiveReservationBoardRow | null;
  /** true si `date` no es hoy: solo cambia el copy ("estado en vivo" vs.
   * "disponibilidad proyectada"); el cálculo es igualmente exacto porque
   * las reservas ahora son diarias. */
  esProyeccion: boolean;
  /** Asignación dueña de la cochera para el día de semana de `date`, si la
   * cochera es fija y tiene dueño ese día (esté liberada o no). `null` si
   * la cochera no es fija o no tiene dueño asignado ese día. Sirve para
   * que el admin pueda mostrar el nombre del dueño (ver components/spot-card.tsx). */
  asignacionDelDia: FixedSpotAssignment | null;
}

/**
 * Proyecta el estado visual de una cochera para `date` (hoy por defecto),
 * combinando el estado base con la disponibilidad fija (asignaciones por
 * día de semana + liberaciones) y con si existe una reserva puntual
 * activa exactamente para esa fecha. `reservationOnDate` debe ser la
 * reserva activa de la cochera para `date` (si existe), resuelta por el
 * caller (ver `components/spots-board.tsx`).
 */
export function computeSpotDisplayForDate(
  spot: ParkingSpot,
  assignments: FixedSpotAssignment[],
  releases: FixedSpotRelease[],
  reservationOnDate: ActiveReservationBoardRow | null | undefined,
  currentUserId: string,
  date: Date = hoyArgentinaDate()
): SpotDisplayInfo {
  const esProyeccion = toLocalDateValue(date) !== hoyArgentina();

  const owningAssignment =
    spot.tipo === "fija" ? getOwningAssignmentOnDate(assignments, spot.id, date) : null;
  const isReleasedOnDate =
    spot.tipo === "fija" ? isSpotReleasedOnDate(assignments, releases, spot.id, date) : undefined;

  const activeReservation = reservationOnDate ?? null;
  const estado = computeSpotDisplayStatus(spot, activeReservation, isReleasedOnDate);
  const esReservaPropia = !!activeReservation && activeReservation.user_id === currentUserId;
  const esDuenioFijo = !!owningAssignment && owningAssignment.user_id === currentUserId;
  // "Mía" solo cuenta como tal si hay una reserva puntual propia, o si es
  // mi día fijo Y sigue asignada (no lo liberé). Si lo liberé (estado
  // 'libre') o alguien más la reservó (estado 'ocupada' de un tercero), no
  // se pinta como propia aunque yo sea el dueño fijo de ese día.
  const esMia = esReservaPropia || (esDuenioFijo && estado === "asignada");

  return {
    estado,
    esMia,
    esReservaPropia,
    reservaActiva: activeReservation,
    esProyeccion,
    asignacionDelDia: owningAssignment,
  };
}


export const ESTADO_LABEL: Record<SpotDisplayEstado, string> = {
  libre: "Libre",
  ocupada: "Ocupada",
  asignada: "Asignada",
  bloqueada: "Bloqueada",
  fuera_de_servicio: "Fuera de servicio",
};

export const ESTADO_BADGE_VARIANT: Record<
  SpotDisplayEstado,
  "success" | "destructive" | "warning" | "muted"
> = {
  libre: "success",
  ocupada: "destructive",
  asignada: "warning",
  bloqueada: "warning",
  fuera_de_servicio: "muted",
};
