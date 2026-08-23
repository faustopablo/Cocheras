// Tipos TypeScript que reflejan el esquema SQL de supabase/migrations.
// Mantener en sincronía manualmente (o regenerar con `supabase gen types typescript`).

export type Rol = "admin" | "colaborador";
export type Jerarquia = "directivo" | "gerente" | "colaborador";
export type TipoCochera = "fija" | "libre";
export type EstadoCochera = "libre" | "ocupada" | "bloqueada" | "fuera_de_servicio";
export type OrigenReserva = "fija_liberada" | "libre" | "invitado";
export type EstadoReserva = "activa" | "cancelada" | "completada" | "no_show";
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
  assigned_user_id: string | null;
  estado: EstadoCochera;
}

export interface Reservation {
  id: string;
  spot_id: string;
  user_id: string | null;
  guest_id: string | null;
  origen: OrigenReserva;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoReserva;
  check_in_at: string | null;
  check_out_at: string | null;
  created_by: string | null;
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
  horas_max_por_reserva: number;
  max_reservas_simultaneas_por_usuario: number;
  minutos_tolerancia_no_show: number;
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
  assigned_user?: Profile | null;
  active_reservation?: Reservation | null;
}

export interface ReservationWithRelations extends Reservation {
  spot?: ParkingSpot & { building?: Building; level?: Level };
  user?: Profile | null;
  guest?: Guest | null;
}
