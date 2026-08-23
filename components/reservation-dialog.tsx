"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createReservationAction } from "@/app/actions/reservations";
import { toLocalInputValue } from "@/lib/utils";
import type { ParkingSpot } from "@/lib/database.types";

export function ReservationDialog({
  spot,
  open,
  onOpenChange,
}: {
  spot: ParkingSpot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"instantanea" | "programada">("instantanea");
  const [inicio, setInicio] = useState(() => toLocalInputValue(new Date()));
  const [fin, setFin] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 4 * 60 * 60 * 1000))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!spot) return null;
  const currentSpot = spot;

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const fechaInicio =
      modo === "instantanea" ? new Date().toISOString() : new Date(inicio).toISOString();
    const fechaFin = new Date(fin).toISOString();

    const result = await createReservationAction({
      spotId: currentSpot.id,
      fechaInicio,
      fechaFin,
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error || "No se pudo crear la reserva.");
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reservar cochera {spot.codigo}</DialogTitle>
          <DialogDescription>
            Elegí si querés usarla ahora mismo o programarla para más adelante.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={modo === "instantanea" ? "default" : "outline"}
              onClick={() => setModo("instantanea")}
              className="flex-1"
            >
              Instantánea
            </Button>
            <Button
              type="button"
              variant={modo === "programada" ? "default" : "outline"}
              onClick={() => setModo("programada")}
              className="flex-1"
            >
              Programada
            </Button>
          </div>

          {modo === "programada" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="inicio">Fecha y hora de inicio</Label>
              <Input
                id="inicio"
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="fin">Fecha y hora de fin</Label>
            <Input
              id="fin"
              type="datetime-local"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Reservando..." : "Confirmar reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
