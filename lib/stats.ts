import type {
  Building,
  FixedSpotRelease,
  Jerarquia,
  Level,
  ParkingSpot,
  Profile,
  Reservation,
} from "@/lib/database.types";
import { isSpotReleasedOnDate } from "@/lib/spot-status";

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

export interface OcupacionPorFranja {
  franja: string;
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

const FRANJAS: { label: string; from: number; to: number }[] = [
  { label: "00-06", from: 0, to: 6 },
  { label: "06-09", from: 6, to: 9 },
  { label: "09-12", from: 9, to: 12 },
  { label: "12-15", from: 12, to: 15 },
  { label: "15-18", from: 15, to: 18 },
  { label: "18-24", from: 18, to: 24 },
];

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

export function calcOcupacionPorFranja(reservations: Reservation[]): OcupacionPorFranja[] {
  const validas = reservasValidas(reservations);
  const total = validas.length || 1;

  return FRANJAS.map(({ label, from, to }) => {
    const enFranja = validas.filter((r) => {
      const hora = new Date(r.fecha_inicio).getHours();
      return hora >= from && hora < to;
    });
    return { franja: label, ocupacion: Math.round((enFranja.length / total) * 100) };
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

export function calcTasaNoShow(reservations: Reservation[]): number {
  const relevantes = reservations.filter(
    (r) => r.estado === "no_show" || r.estado === "completada" || r.estado === "activa"
  );
  if (relevantes.length === 0) return 0;
  const noShows = relevantes.filter((r) => r.estado === "no_show").length;
  return Math.round((noShows / relevantes.length) * 1000) / 10;
}

export function calcFijasLiberadasVsBloqueadas(
  spots: ParkingSpot[],
  fixedSpotReleases: FixedSpotRelease[]
): FijasLiberadasVsBloqueadas {
  // "Liberada" = hoy cae dentro de un rango liberado activo (ver
  // fixed_spot_releases); las fuera de servicio no cuentan como
  // liberadas aunque tengan una liberación vigente.
  const fijas = spots.filter((s) => s.tipo === "fija" && s.estado !== "fuera_de_servicio");
  const liberadas = fijas.filter((s) => isSpotReleasedOnDate(fixedSpotReleases, s.id)).length;
  return {
    liberadas,
    bloqueadas: fijas.length - liberadas,
  };
}
