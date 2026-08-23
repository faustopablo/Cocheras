import { createClient } from "@/lib/supabase/server";
import {
  calcFijasLiberadasVsBloqueadas,
  calcOcupacionPorEdificio,
  calcOcupacionPorFranja,
  calcOcupacionPorSubsuelo,
  calcRankingCocheras,
  calcRotacionPorJerarquia,
  calcRotacionPorUsuario,
  calcTasaNoShow,
} from "@/lib/stats";
import {
  FijasLiberadasChart,
  NoShowStat,
  OcupacionPorEdificioChart,
  OcupacionPorFranjaChart,
  OcupacionPorSubsueloChart,
  RankingCocherasChart,
  RotacionPorJerarquiaChart,
  RotacionPorUsuarioTable,
} from "@/components/admin/stats-charts";
import type {
  Building,
  FixedSpotRelease,
  Level,
  ParkingSpot,
  Profile,
  Reservation,
} from "@/lib/database.types";

export const metadata = { title: "Estadísticas — Admin Cocheras Comafi" };

export default async function AdminEstadisticasPage() {
  const supabase = await createClient();

  const [
    { data: buildings },
    { data: levels },
    { data: spots },
    { data: profiles },
    { data: reservations },
    { data: releases },
  ] = await Promise.all([
    supabase.from("buildings").select("*"),
    supabase.from("levels").select("*"),
    supabase.from("parking_spots").select("*"),
    supabase.from("profiles").select("*"),
    supabase.from("reservations").select("*"),
    supabase.from("fixed_spot_releases").select("*").eq("estado", "activa"),
  ]);

  const b = (buildings ?? []) as Building[];
  const l = (levels ?? []) as Level[];
  const s = (spots ?? []) as ParkingSpot[];
  const p = (profiles ?? []) as Profile[];
  const r = (reservations ?? []) as Reservation[];
  const fr = (releases ?? []) as FixedSpotRelease[];

  const ocupacionEdificio = calcOcupacionPorEdificio(b, s, r);
  const ocupacionSubsuelo = calcOcupacionPorSubsuelo(b, l, s, r);
  const ocupacionFranja = calcOcupacionPorFranja(r);
  const rotacionJerarquia = calcRotacionPorJerarquia(p, r);
  const rotacionUsuario = calcRotacionPorUsuario(p, r);
  const ranking = calcRankingCocheras(s, b, r);
  const tasaNoShow = calcTasaNoShow(r);
  const fijas = calcFijasLiberadasVsBloqueadas(s, fr);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estadísticas</h1>
        <p className="text-sm text-muted-foreground">
          KPIs de uso de las cocheras. Cada gráfico incluye una vista de tabla accesible.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <OcupacionPorEdificioChart data={ocupacionEdificio} />
        <OcupacionPorSubsueloChart data={ocupacionSubsuelo} />
        <OcupacionPorFranjaChart data={ocupacionFranja} />
        <RotacionPorJerarquiaChart data={rotacionJerarquia} />
      </div>

      <RankingCocherasChart masUsadas={ranking.masUsadas} menosUsadas={ranking.menosUsadas} />

      <div className="grid gap-4 md:grid-cols-2">
        <NoShowStat tasa={tasaNoShow} />
        <FijasLiberadasChart data={fijas} />
      </div>

      <RotacionPorUsuarioTable data={rotacionUsuario} />
    </div>
  );
}
