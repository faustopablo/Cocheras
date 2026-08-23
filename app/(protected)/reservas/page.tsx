import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReservationsList } from "@/components/reservations-list";
import type { ReservationWithRelations } from "@/lib/database.types";

export const metadata = { title: "Mis reservas — Cocheras Comafi" };

export default async function ReservasPage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("reservations")
    .select("*, spot:parking_spots(*, building:buildings(*), level:levels(*))")
    .eq("user_id", user.id)
    .order("fecha_inicio", { ascending: false });

  const reservas = (data ?? []) as ReservationWithRelations[];
  const activas = reservas.filter((r) => r.estado === "activa");
  const historial = reservas.filter((r) => r.estado !== "activa");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mis reservas</h1>
        <p className="text-sm text-muted-foreground">
          Gestioná el check-in / check-out y cancelá reservas si cambian tus planes.
        </p>
      </div>
      <ReservationsList activas={activas} historial={historial} />
    </div>
  );
}
