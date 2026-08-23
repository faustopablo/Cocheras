"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SpotCard } from "@/components/spot-card";
import { ReservationDialog } from "@/components/reservation-dialog";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { FixedSpotReleaseDialog } from "@/components/fixed-spot-release-dialog";
import { cancelFixedSpotReleaseAction } from "@/app/actions/reservations";
import { isSpotReleasedOnDate } from "@/lib/spot-status";
import { formatDate } from "@/lib/utils";
import type { Building, FixedSpotRelease, Level, ParkingSpot, Reservation } from "@/lib/database.types";

export function SpotsBoard({
  buildings,
  levels,
  spots,
  activeReservations,
  fixedSpotReleases,
  currentUserId,
}: {
  buildings: Building[];
  levels: Level[];
  spots: ParkingSpot[];
  activeReservations: Reservation[];
  fixedSpotReleases: FixedSpotRelease[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingReleaseId, setPendingReleaseId] = useState<string | null>(null);

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

  const releasesBySpot = useMemo(() => {
    const map = new Map<string, FixedSpotRelease[]>();
    for (const r of fixedSpotReleases) {
      const arr = map.get(r.spot_id) ?? [];
      arr.push(r);
      map.set(r.spot_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde));
    }
    return map;
  }, [fixedSpotReleases]);

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

  async function handleCancelarLiberacion(releaseId: string) {
    if (!confirm("¿Cancelar esta liberación? Las reservas que otros hayan hecho dentro del rango no se cancelan automáticamente.")) {
      return;
    }
    setPendingReleaseId(releaseId);
    const res = await cancelFixedSpotReleaseAction(releaseId);
    setPendingReleaseId(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <RealtimeRefresher tables={["parking_spots", "reservations", "fixed_spot_releases"]} />

      {misCocherasFijas.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Mi cochera fija</CardTitle>
            <CardDescription>
              Liberala por un rango de fechas (ej. vacaciones) para que otro colaborador pueda
              reservarla en ese período.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {misCocherasFijas.map((s) => {
              const liberadaHoy = isSpotReleasedOnDate(fixedSpotReleases, s.id);
              const liberacionesDeEstaCochera = releasesBySpot.get(s.id) ?? [];
              return (
                <div key={s.id} className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{s.codigo}</p>
                      <p className="text-xs text-muted-foreground">
                        {liberadaHoy ? "Liberada hoy — disponible para otros" : "Reservada para vos hoy"}
                      </p>
                    </div>
                    <FixedSpotReleaseDialog spotId={s.id} codigo={s.codigo} />
                  </div>

                  {liberacionesDeEstaCochera.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-border pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Liberaciones programadas
                      </p>
                      {liberacionesDeEstaCochera.map((r) => (
                        <div
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-3 py-2"
                        >
                          <div className="text-sm">
                            <span className="font-medium">
                              {formatDate(r.fecha_desde)} — {formatDate(r.fecha_hasta)}
                            </span>
                            {r.motivo && <span className="text-muted-foreground"> · {r.motivo}</span>}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pendingReleaseId === r.id}
                            onClick={() => handleCancelarLiberacion(r.id)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Si cancelás una liberación en curso, las reservas que ya hayan hecho otros
                        colaboradores dentro de ese rango se mantienen; no se cancelan
                        automáticamente.
                      </p>
                    </div>
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
                      isReleasedToday={
                        spot.tipo === "fija" ? isSpotReleasedOnDate(fixedSpotReleases, spot.id) : undefined
                      }
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
