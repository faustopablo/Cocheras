import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SpotsBoard } from "@/components/spots-board";
import type { Building, Level, ParkingSpot, Reservation } from "@/lib/database.types";

export const metadata = { title: "Cocheras — Cocheras Comafi" };

export default async function HomePage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const [{ data: buildings }, { data: levels }, { data: spots }, { data: reservations }] =
    await Promise.all([
      supabase.from("buildings").select("*").eq("activo", true).order("nombre"),
      supabase.from("levels").select("*").order("nombre"),
      supabase.from("parking_spots").select("*").order("codigo"),
      supabase.from("reservations").select("*").eq("estado", "activa"),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cocheras disponibles</h1>
        <p className="text-sm text-muted-foreground">
          Estado en vivo por edificio y subsuelo. Los cambios de otros usuarios se reflejan
          automáticamente.
        </p>
      </div>
      <SpotsBoard
        buildings={(buildings ?? []) as Building[]}
        levels={(levels ?? []) as Level[]}
        spots={(spots ?? []) as ParkingSpot[]}
        activeReservations={(reservations ?? []) as Reservation[]}
        currentUserId={user.id}
      />
    </div>
  );
}
