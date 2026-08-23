import { createClient } from "@/lib/supabase/server";
import { SpotsManager } from "@/components/admin/spots-manager";
import type { Building, Level, ParkingSpot, Profile } from "@/lib/database.types";

export const metadata = { title: "Cocheras — Admin Cocheras Comafi" };

export default async function AdminCocherasPage() {
  const supabase = await createClient();

  const [{ data: buildings }, { data: levels }, { data: spots }, { data: profiles }] =
    await Promise.all([
      supabase.from("buildings").select("*").order("nombre"),
      supabase.from("levels").select("*").order("nombre"),
      supabase.from("parking_spots").select("*").order("codigo"),
      supabase.from("profiles").select("*").order("nombre"),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cocheras</h1>
        <p className="text-sm text-muted-foreground">
          ABM de cocheras. Asigná cocheras fijas a un colaborador y marcá cuáles son prereservadas.
        </p>
      </div>
      <SpotsManager
        buildings={(buildings ?? []) as Building[]}
        levels={(levels ?? []) as Level[]}
        spots={(spots ?? []) as ParkingSpot[]}
        profiles={(profiles ?? []) as Profile[]}
      />
    </div>
  );
}
