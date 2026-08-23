"use client";

import { Car, Lock, Ban, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { computeSpotDisplayStatus, ESTADO_LABEL, ESTADO_BADGE_VARIANT } from "@/lib/spot-status";
import type { ParkingSpot, Reservation } from "@/lib/database.types";

const ICONS = {
  libre: CheckCircle2,
  ocupada: Car,
  bloqueada: Lock,
  fuera_de_servicio: Ban,
};

export function SpotCard({
  spot,
  activeReservation,
  onReservar,
  esMia,
}: {
  spot: ParkingSpot;
  activeReservation?: Reservation | null;
  onReservar?: (spot: ParkingSpot) => void;
  esMia?: boolean;
}) {
  const estado = computeSpotDisplayStatus(spot, activeReservation);
  const Icon = ICONS[estado];
  const puedeReservar = estado === "libre" && !esMia;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-shadow hover:shadow-md",
        esMia && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground">{spot.codigo}</span>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant={ESTADO_BADGE_VARIANT[estado]}>{ESTADO_LABEL[estado]}</Badge>
        {spot.tipo === "fija" && <Badge variant="outline">Fija</Badge>}
      </div>
      {puedeReservar && onReservar && (
        <Button size="sm" onClick={() => onReservar(spot)} className="mt-1">
          Reservar
        </Button>
      )}
    </div>
  );
}
