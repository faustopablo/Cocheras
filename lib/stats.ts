import type {
  Building,
  FixedSpotAssignment,
  FixedSpotRelease,
  Jerarquia,
  Level,
  ParkingSpot,
  Profile,
  Reservation,
} from "@/lib/database.types";
import { isSpotReleasedOnDate } from "@/lib/spot-status";
import { DIAS_SEMANA } from "@/lib/utils";

export interface OcupacionPorEdificio {
  edificio: string;
  ocupacion: number;
  totalCocheras: number;
  reservasCompletadasOActivas: number;
}

export interface OcupacionPorSubsuelo {
  etiqueta: string;
  edificio: string;
  ocupacion: number;
}

export interface OcupacionPorDiaSemana {
  dia: string;
  ocupacion: number;
}

export interface RotacionPorJerarquia {
  jerarquia: Jerarquia;
  reservas: number;
}

export interface RotacionPorUsuario {
  usuario: string;
  jerarquia: Jerarquia;
  reservas: number;
}

export interface RankingCochera {
  codigo: string;
  edificio: string;
  usos: number;
}

export interface FijasLiberadasVsBloqueadas {
  liberadas: number;
  bloqueadas: number;
}

/** Día de la semana ISO (1=lunes..7=domingo) de una fecha "yyyy-MM-dd". */
function isoWeekdayFromFecha(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

function reservasValidas(reservations: Reservation[]) {
  return reservations.filter((r) => r.estado === "activa" || r.estado === "completada");
}

export function calcOcupacionPorEdificio(
  buildings: Building[],
  spots: ParkingSpot[],
  reservations: Reservation[]
): OcupacionPorEdificio[] {
  const validas = reservasValidas(reservations);
  const spotById = new Map(spots.map((s) => [s.id, s]));

  return buildings.map((b) => {
    const spotsEdificio = spots.filter((s) => s.building_id === b.id);
    const reservasEdificio = validas.filter((r) => spotById.get(r.spot_id)?.building_id === b.id);
    const total = spotsEdificio.length || 1;
    return {
      edificio: b.nombre,
      ocupacion: Math.round((reservasEdificio.length / total) * 100) / 1,
      totalCocheras: spotsEdificio.length,
      reservasCompletadasOActivas: reservasEdificio.length,
    };
  });
}

export function calcOcupacionPorSubsuelo(
  buildings: Building[],
  levels: Level[],
  spots: ParkingSpot[],
  reservations: Reservation[]
): OcupacionPorSubsuelo[] {
  const validas = reservasValidas(reservations);
  const spotById = new Map(spots.map((s) => [s.id, s]));
  const buildingById = new Map(buildings.map((b) => [b.id, b]));

  return levels.map((level) => {
    const spotsLevel = spots.filter((s) => s.level_id === level.id);
    const reservasLevel = validas.filter((r) => spotById.get(r.spot_id)?.level_id === level.id);
    const total = spotsLevel.length || 1;
    return {
      etiqueta: level.nombre,
      edificio: buildingById.get(level.building_id)?.nombre ?? "-",
      ocupacion: Math.round((reservasLevel.length / total) * 100) / 1,
    };
  });
}

export function calcOcupacionPorDiaSemana(reservations: Reservation[]): OcupacionPorDiaSemana[] {
  const validas = reservasValidas(reservations);
  const total = validas.length || 1;

  return DIAS_SEMANA.map(({ value, label }) => {
    const enDia = validas.filter((r) => isoWeekdayFromFecha(r.fecha) === value);
    return { dia: label, ocupacion: Math.round((enDia.length / total) * 100) };
  });
}

export function calcRotacionPorJerarquia(
  profiles: Profile[],
  reservations: Reservation[]
): RotacionPorJerarquia[] {
  const validas = reservasValidas(reservations);
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const jerarquias: Jerarquia[] = ["colaborador", "gerente", "directivo"];

  return jerarquias.map((j) => ({
    jerarquia: j,
    reservas: validas.filter((r) => r.user_id && profileById.get(r.user_id)?.jerarquia === j).length,
  }));
}

export function calcRotacionPorUsuario(
  profiles: Profile[],
  reservations: Reservation[],
  top = 8
): RotacionPorUsuario[] {
  const validas = reservasValidas(reservations);
  const counts = new Map<string, number>();
  validas.forEach((r) => {
    if (!r.user_id) return;
    counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([userId, reservas]) => {
      const p = profiles.find((pr) => pr.id === userId);
      return { usuario: p?.nombre ?? "Desconocido", jerarquia: p?.jerarquia ?? "colaborador", reservas };
    })
    .sort((a, b) => b.reservas - a.reservas)
    .slice(0, top);
}

export function calcRankingCocheras(
  spots: ParkingSpot[],
  buildings: Building[],
  reservations: Reservation[]
): { masUsadas: RankingCochera[]; menosUsadas: RankingCochera[] } {
  const validas = reservasValidas(reservations);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const counts = new Map<string, number>();
  validas.forEach((r) => counts.set(r.spot_id, (counts.get(r.spot_id) ?? 0) + 1));

  const ranking: RankingCochera[] = spots.map((s) => ({
    codigo: s.codigo,
    edificio: buildingById.get(s.building_id)?.nombre ?? "-",
    usos: counts.get(s.id) ?? 0,
  }));

  const ordenado = [...ranking].sort((a, b) => b.usos - a.usos);
  return {
    masUsadas: ordenado.slice(0, 5),
    menosUsadas: [...ordenado].sort((a, b) => a.usos - b.usos).slice(0, 5),
  };
}

/**
 * Tasa de cancelación: proporción de reservas canceladas sobre el total
 * de reservas "cerradas" (canceladas + completadas + activas). Sustituye
 * a la antigua "tasa de no-show" ahora que la reserva confirmada equivale
 * a check-in automático y ya no se liberan reservas por falta de
 * check-in.
 */
export function calcTasaCancelacion(reservations: Reservation[]): number {
  const relevantes = reservations.filter(
    (r) => r.estado === "cancelada" || r.estado === "completada" || r.estado === "activa"
  );
  if (relevantes.length === 0) return 0;
  const canceladas = relevantes.filter((r) => r.estado === "cancelada").length;
  return Math.round((canceladas / relevantes.length) * 1000) / 10;
}

export function calcFijasLiberadasVsBloqueadas(
  spots: ParkingSpot[],
  fixedSpotAssignments: FixedSpotAssignment[],
  fixedSpotReleases: FixedSpotRelease[]
): FijasLiberadasVsBloqueadas {
  // "Liberada" = hoy (según el día de la semana) no tiene dueño
  // asignado, o el dueño de hoy la liberó (ver fixed_spot_releases); las
  // fuera de servicio no cuentan como liberadas aunque estén disponibles.
  const fijas = spots.filter((s) => s.tipo === "fija" && s.estado !== "fuera_de_servicio");
  const liberadas = fijas.filter((s) =>
    isSpotReleasedOnDate(fixedSpotAssignments, fixedSpotReleases, s.id)
  ).length;
  return {
    liberadas,
    bloqueadas: fijas.length - liberadas,
  };
}
