import { createClient } from "@/lib/supabase/server";
import { AdminReservationsTable } from "@/components/admin/admin-reservations-table";
import type { ParkingSpot, ReservationWithRelations } from "@/lib/database.types";

export const metadata = { title: "Reservas — Admin Cocheras Comafi" };

export default async function AdminReservasPage() {
  const supabase = await createClient();

  const [{ data: reservations }, { data: spots }] = await Promise.all([
    supabase
      .from("reservations")
      .select(
        "*, spot:parking_spots(*, building:buildings(*), level:levels(*)), user:profiles(*), guest:guests(*)"
      )
      .order("fecha_inicio", { ascending: false })
      .limit(300),
    supabase.from("parking_spots").select("*"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reservas — vista global</h1>
        <p className="text-sm text-muted-foreground">
          Filtrá por estado o edificio, cancelá o reasigná reservas activas.
        </p>
      </div>
      <AdminReservationsTable
        reservations={(reservations ?? []) as ReservationWithRelations[]}
        spots={(spots ?? []) as ParkingSpot[]}
      />
    </div>
  );
}
