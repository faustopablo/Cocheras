import { createClient } from "@/lib/supabase/server";
import { BuildingsManager } from "@/components/admin/buildings-manager";
import type { Building, Level, ParkingSpot } from "@/lib/database.types";

export const metadata = { title: "Edificios — Admin Cocheras Comafi" };

export default async function AdminEdificiosPage() {
  const supabase = await createClient();

  const [{ data: buildings }, { data: levels }, { data: spots }] = await Promise.all([
    supabase.from("buildings").select("*").order("nombre"),
    supabase.from("levels").select("*").order("nombre"),
    supabase.from("parking_spots").select("*").order("codigo"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edificios</h1>
        <p className="text-sm text-muted-foreground">
          ABM de edificios y subsuelos. Para dar de alta o editar cocheras, entrá a{" "}
          <span className="font-medium">Gestionar cocheras</span> dentro de cada edificio.
        </p>
      </div>
      <BuildingsManager
        buildings={(buildings ?? []) as Building[]}
        levels={(levels ?? []) as Level[]}
        spots={(spots ?? []) as ParkingSpot[]}
      />
    </div>
  );
}
