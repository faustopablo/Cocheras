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
import { hoyArgentina, toLocalDateValue } from "@/lib/utils";
import type { ParkingSpot } from "@/lib/database.types";

export function ReservationDialog({
  spot,
  open,
  onOpenChange,
  defaultDate,
}: {
  spot: ParkingSpot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fecha propuesta por defecto (ej. la seleccionada en el tablero). Hoy si no se pasa. */
  defaultDate?: Date;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState(() => toLocalDateValue(defaultDate ?? new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!spot) return null;
  const currentSpot = spot;
  const minFecha = hoyArgentina();

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const result = await createReservationAction({
      spotId: currentSpot.id,
      fecha,
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
            Las reservas son por día completo: elegí la fecha que necesitás.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha-reserva">Fecha</Label>
            <Input
              id="fecha-reserva"
              type="date"
              min={minFecha}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
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
