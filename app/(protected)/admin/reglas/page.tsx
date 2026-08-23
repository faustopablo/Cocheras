import { createClient } from "@/lib/supabase/server";
import { RulesManager } from "@/components/admin/rules-manager";
import type { Building, ParkingRule } from "@/lib/database.types";

export const metadata = { title: "Reglas — Admin Cocheras Comafi" };

export default async function AdminReglasPage() {
  const supabase = await createClient();

  const [{ data: buildings }, { data: rules }] = await Promise.all([
    supabase.from("buildings").select("*").order("nombre"),
    supabase.from("parking_rules").select("*"),
  ]);

  const allRules = (rules ?? []) as ParkingRule[];
  const globalRule = allRules.find((r) => r.building_id === null) ?? null;
  const rulesByBuilding = Object.fromEntries(
    allRules.filter((r) => r.building_id !== null).map((r) => [r.building_id as string, r])
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reglas de reserva</h1>
        <p className="text-sm text-muted-foreground">
          Definí límites globales y particulares por edificio.
        </p>
      </div>
      <RulesManager
        buildings={(buildings ?? []) as Building[]}
        globalRule={globalRule}
        rulesByBuilding={rulesByBuilding}
      />
    </div>
  );
}
