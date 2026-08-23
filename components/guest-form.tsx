"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createGuestReservationAction } from "@/app/actions/guests";
import { toLocalInputValue } from "@/lib/utils";
import type { ParkingSpot } from "@/lib/database.types";

export function GuestForm({ availableSpots }: { availableSpots: ParkingSpot[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [patente, setPatente] = useState("");
  const [spotId, setSpotId] = useState<string>("");
  const [inicio, setInicio] = useState(() => toLocalInputValue(new Date()));
  const [fin, setFin] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 4 * 60 * 60 * 1000))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!spotId) {
      setError("Elegí una cochera.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await createGuestReservationAction({
      nombre,
      empresa,
      patente,
      spotId,
      fechaInicio: new Date(inicio).toISOString(),
      fechaFin: new Date(fin).toISOString(),
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error || "No se pudo registrar al invitado.");
      return;
    }
    setSuccess(true);
    setNombre("");
    setEmpresa("");
    setPatente("");
    setSpotId("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar invitado</CardTitle>
        <CardDescription>
          Solo se registran nombre, empresa y patente (por política de datos del banco no se
          solicita DNI).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-nombre">Nombre y apellido</Label>
              <Input id="g-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-empresa">Empresa</Label>
              <Input id="g-empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-patente">Patente</Label>
              <Input
                id="g-patente"
                value={patente}
                onChange={(e) => setPatente(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-spot">Cochera</Label>
              <Select value={spotId} onValueChange={setSpotId}>
                <SelectTrigger id="g-spot">
                  <SelectValue placeholder="Elegir cochera disponible" />
                </SelectTrigger>
                <SelectContent>
                  {availableSpots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-inicio">Desde</Label>
              <Input
                id="g-inicio"
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-fin">Hasta</Label>
              <Input
                id="g-fin"
                type="datetime-local"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-success bg-success/10 rounded-md px-3 py-2">
              Invitado registrado correctamente.
            </p>
          )}

          <Button type="submit" disabled={loading} className="self-start">
            {loading ? "Guardando..." : "Registrar reserva de invitado"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
