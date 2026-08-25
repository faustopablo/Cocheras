// Tipos TypeScript que reflejan el esquema SQL de supabase/migrations.
// Mantener en sincronía manualmente (o regenerar con `supabase gen types typescript`).

export type Rol = "admin" | "asistente" | "colaborador";
export type Jerarquia = "directivo" | "gerente" | "colaborador";
export type TipoCochera = "fija" | "libre";
export type EstadoCochera = "libre" | "ocupada" | "bloqueada" | "fuera_de_servicio";
export type OrigenReserva = "fija_liberada" | "libre" | "invitado";
/**
 * "no_show" queda en el enum por compatibilidad con datos históricos
 * (reservas liberadas por falta de check-in cuando ese concepto existía),
 * pero desde que la reserva confirmada equivale a check-in automático
 * ninguna función ni acción de la app vuelve a producirlo.
 */
export type EstadoReserva = "activa" | "cancelada" | "completada" | "no_show";
export type EstadoLiberacion = "activa" | "cancelada";
export type TipoNotificacion =
  | "reserva_confirmada"
  | "reserva_cancelada"
  | "no_show_liberada"
  | "recordatorio"
  | "cochera_fija_liberada"
  | "otro";

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  jerarquia: Jerarquia;
  activo: boolean;
  created_at: string;
}

export interface Building {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
}

export interface Level {
  id: string;
  building_id: string;
  nombre: string;
}

export interface ParkingSpot {
  id: string;
  building_id: string;
  level_id: string;
  codigo: string;
  tipo: TipoCochera;
  es_prereservada: boolean;
  estado: EstadoCochera;
}

/** 1=lunes ... 7=domingo (ISO). */
export type DiaSemanaIso = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface FixedSpotAssignment {
  id: string;
  spot_id: string;
  user_id: string;
  dias: DiaSemanaIso[];
  created_at: string;
}

export interface Reservation {
  id: string;
  spot_id: string;
  user_id: string | null;
  guest_id: string | null;
  origen: OrigenReserva;
  /** Fecha (día completo) de la reserva. yyyy-MM-dd. */
  fecha: string;
  estado: EstadoReserva;
  created_by: string | null;
  created_at: string;
}

export interface FixedSpotRelease {
  id: string;
  spot_id: string;
  user_id: string;
  assignment_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  motivo: string | null;
  estado: EstadoLiberacion;
  created_at: string;
}

export interface Guest {
  id: string;
  nombre: string;
  empresa: string | null;
  patente: string;
}

export interface ParkingRule {
  id: string;
  building_id: string | null;
  dias_max_reserva_futura: number;
  max_reservas_simultaneas_por_usuario: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  tipo: TipoNotificacion;
  mensaje: string;
  leida: boolean;
  created_at: string;
}

// Vistas compuestas usadas en la UI
export interface SpotWithRelations extends ParkingSpot {
  building?: Building;
  level?: Level;
  assignments?: FixedSpotAssignment[];
  active_reservation?: Reservation | null;
}

export interface ReservationWithRelations extends Reservation {
  spot?: ParkingSpot & { building?: Building; level?: Level };
  user?: Profile | null;
  guest?: Guest | null;
}
