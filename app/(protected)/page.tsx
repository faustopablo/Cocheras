import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SpotsBoard } from "@/components/spots-board";
import type {
  Building,
  FixedSpotAssignment,
  FixedSpotRelease,
  Level,
  ParkingSpot,
  Reservation,
} from "@/lib/database.types";

export const metadata = { title: "Cocheras — Cocheras Comafi" };

export default async function HomePage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const [
    { data: buildings },
    { data: levels },
    { data: spots },
    { data: reservations },
    { data: assignments },
    { data: releases },
  ] = await Promise.all([
    supabase.from("buildings").select("*").eq("activo", true).order("nombre"),
    supabase.from("levels").select("*").order("nombre"),
    supabase.from("parking_spots").select("*").order("codigo"),
    supabase.from("reservations").select("*").eq("estado", "activa"),
    supabase.from("fixed_spot_assignments").select("*"),
    // Solo se necesitan las liberaciones activas y no vencidas: alcanzan
    // para calcular disponibilidad de hoy y para listar las programadas.
    supabase
      .from("fixed_spot_releases")
      .select("*")
      .eq("estado", "activa")
      .gte("fecha_hasta", new Date().toISOString().slice(0, 10))
      .order("fecha_desde"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cocheras disponibles</h1>
        <p className="text-sm text-muted-foreground">
          Estado en vivo por edificio y subsuelo para hoy. Los cambios de otros usuarios se
          reflejan automáticamente. Elegí otra fecha para ver la disponibilidad proyectada de
          cocheras fijas (asignaciones y liberaciones); las reservas puntuales de otros
          colaboradores no se proyectan a futuro.
        </p>
      </div>
      <SpotsBoard
        buildings={(buildings ?? []) as Building[]}
        levels={(levels ?? []) as Level[]}
        spots={(spots ?? []) as ParkingSpot[]}
        activeReservations={(reservations ?? []) as Reservation[]}
        fixedSpotAssignments={(assignments ?? []) as FixedSpotAssignment[]}
        fixedSpotReleases={(releases ?? []) as FixedSpotRelease[]}
        currentUserId={user.id}
      />
    </div>
  );
}
