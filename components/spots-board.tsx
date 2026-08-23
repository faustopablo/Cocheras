"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SpotCard } from "@/components/spot-card";
import { ReservationDialog } from "@/components/reservation-dialog";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { releaseFixedSpotAction, reclaimFixedSpotAction } from "@/app/actions/reservations";
import type { Building, Level, ParkingSpot, Reservation } from "@/lib/database.types";

export function SpotsBoard({
  buildings,
  levels,
  spots,
  activeReservations,
  currentUserId,
}: {
  buildings: Building[];
  levels: Level[];
  spots: ParkingSpot[];
  activeReservations: Reservation[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingSpotId, setPendingSpotId] = useState<string | null>(null);

  const reservationBySpot = useMemo(() => {
    const map = new Map<string, Reservation>();
    for (const r of activeReservations) {
      if (!map.has(r.spot_id)) map.set(r.spot_id, r);
    }
    return map;
  }, [activeReservations]);

  const misCocherasFijas = spots.filter(
    (s) => s.tipo === "fija" && s.assigned_user_id === currentUserId
  );

  const levelsByBuilding = useMemo(() => {
    const map = new Map<string, Level[]>();
    for (const l of levels) {
      const arr = map.get(l.building_id) ?? [];
      arr.push(l);
      map.set(l.building_id, arr);
    }
    return map;
  }, [levels]);

  const spotsByLevel = useMemo(() => {
    const map = new Map<string, ParkingSpot[]>();
    for (const s of spots) {
      const arr = map.get(s.level_id) ?? [];
      arr.push(s);
      map.set(s.level_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.codigo.localeCompare(b.codigo));
    }
    return map;
  }, [spots]);

  async function handleLiberar(spotId: string) {
    setPendingSpotId(spotId);
    const res = await releaseFixedSpotAction(spotId);
    setPendingSpotId(null);
    if (res.ok) router.refresh();
  }

  async function handleTomar(spotId: string) {
    setPendingSpotId(spotId);
    const res = await reclaimFixedSpotAction(spotId);
    setPendingSpotId(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <RealtimeRefresher tables={["parking_spots", "reservations"]} />

      {misCocherasFijas.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Mi cochera fija</CardTitle>
            <CardDescription>
              Liberala si no la vas a usar hoy para que otro colaborador pueda reservarla, o
              retomala en cualquier momento.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {misCocherasFijas.map((s) => {
              const liberada = s.estado === "libre";
              return (
                <div
                  key={s.id}
                  className="flex min-w-[220px] flex-1 items-center justify-between gap-3 rounded-lg border border-border bg-muted p-3"
                >
                  <div>
                    <p className="font-semibold">{s.codigo}</p>
                    <p className="text-xs text-muted-foreground">
                      {liberada ? "Liberada — disponible para otros" : "Reservada para vos"}
                    </p>
                  </div>
                  {liberada ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pendingSpotId === s.id}
                      onClick={() => handleTomar(s.id)}
                    >
                      Tomar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingSpotId === s.id}
                      onClick={() => handleLiberar(s.id)}
                    >
                      Liberar
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {buildings.map((building) => (
        <section key={building.id} className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{building.nombre}</h2>
            {building.direccion && (
              <p className="text-sm text-muted-foreground">{building.direccion}</p>
            )}
          </div>

          {(levelsByBuilding.get(building.id) ?? []).map((level) => {
            const levelSpots = spotsByLevel.get(level.id) ?? [];
            if (levelSpots.length === 0) return null;
            return (
              <div key={level.id} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {level.nombre}
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {levelSpots.map((spot) => (
                    <SpotCard
                      key={spot.id}
                      spot={spot}
                      activeReservation={reservationBySpot.get(spot.id)}
                      esMia={spot.assigned_user_id === currentUserId}
                      onReservar={(s) => {
                        setSelectedSpot(s);
                        setDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}

      <ReservationDialog spot={selectedSpot} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
