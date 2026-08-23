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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createFixedSpotReleaseAction } from "@/app/actions/reservations";
import { formatDias, toLocalDateValue } from "@/lib/utils";

export function FixedSpotReleaseDialog({
  assignmentId,
  codigo,
  dias,
}: {
  assignmentId: string;
  codigo: string;
  dias: number[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const today = toLocalDateValue(new Date());
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (desde < today) {
      setError("La fecha desde no puede estar en el pasado.");
      return;
    }
    if (hasta < desde) {
      setError("La fecha hasta no puede ser anterior a la fecha desde.");
      return;
    }

    setLoading(true);
    const result = await createFixedSpotReleaseAction({
      assignmentId,
      fechaDesde: desde,
      fechaHasta: hasta,
      motivo,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error || "No se pudo crear la liberación.");
      return;
    }

    setOpen(false);
    setMotivo("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Liberar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar cochera {codigo}</DialogTitle>
          <DialogDescription>
            Tus días asignados son {formatDias(dias)}. Elegí el rango de fechas en el que no la
            vas a usar (ej. vacaciones) para que otro colaborador pueda reservarla esos días en
            ese período.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fecha-desde">Desde</Label>
              <Input
                id="fecha-desde"
                type="date"
                min={today}
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fecha-hasta">Hasta</Label>
              <Input
                id="fecha-hasta"
                type="date"
                min={desde}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Input
              id="motivo"
              placeholder="Ej. Vacaciones"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Confirmar liberación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
