"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { adminCancelReservationAction, adminReassignReservationAction } from "@/app/actions/admin-reservations";
import type { EstadoReserva, ParkingSpot, ReservationWithRelations } from "@/lib/database.types";

const ESTADO_VARIANT: Record<EstadoReserva, "success" | "muted" | "destructive" | "warning"> = {
  activa: "success",
  completada: "muted",
  cancelada: "destructive",
  no_show: "warning",
};

export function AdminReservationsTable({
  reservations,
  spots,
}: {
  reservations: ReservationWithRelations[];
  spots: ParkingSpot[];
}) {
  const router = useRouter();
  const [filtroEstado, setFiltroEstado] = useState<string>("todas");
  const [filtroBuilding, setFiltroBuilding] = useState<string>("todos");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const buildings = useMemo(() => {
    const map = new Map<string, string>();
    reservations.forEach((r) => {
      if (r.spot?.building) map.set(r.spot.building.id, r.spot.building.nombre);
    });
    return Array.from(map.entries());
  }, [reservations]);

  const filtradas = reservations.filter((r) => {
    if (filtroEstado !== "todas" && r.estado !== filtroEstado) return false;
    if (filtroBuilding !== "todos" && r.spot?.building?.id !== filtroBuilding) return false;
    return true;
  });

  async function handleCancel(id: string) {
    setLoadingId(id);
    const res = await adminCancelReservationAction(id);
    setLoadingId(null);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  async function handleReassign(id: string, currentSpotId: string) {
    const libres = spots.filter((s) => s.estado === "libre" && s.id !== currentSpotId);
    if (libres.length === 0) {
      alert("No hay cocheras libres disponibles para reasignar.");
      return;
    }
    const opciones = libres.map((s, i) => `${i + 1}. ${s.codigo}`).join("\n");
    const seleccion = prompt(`Elegí el número de la cochera destino:\n${opciones}`);
    const idx = Number(seleccion) - 1;
    if (isNaN(idx) || idx < 0 || idx >= libres.length) return;

    setLoadingId(id);
    const res = await adminReassignReservationAction({ reservationId: id, newSpotId: libres[idx].id });
    setLoadingId(null);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservas</CardTitle>
        <div className="flex flex-wrap gap-3 pt-2">
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los estados</SelectItem>
              <SelectItem value="activa">Activa</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
              <SelectItem value="no_show">No-show</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroBuilding} onValueChange={setFiltroBuilding}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Edificio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los edificios</SelectItem>
              {buildings.map(([id, nombre]) => (
                <SelectItem key={id} value={id}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cochera</TableHead>
              <TableHead>Edificio</TableHead>
              <TableHead>Titular</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.spot?.codigo}</TableCell>
                <TableCell>{r.spot?.building?.nombre}</TableCell>
                <TableCell>{r.user?.nombre ?? r.guest?.nombre ?? "-"}</TableCell>
                <TableCell>{r.origen}</TableCell>
                <TableCell>{formatDateTime(r.fecha_inicio)}</TableCell>
                <TableCell>{formatDateTime(r.fecha_fin)}</TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[r.estado]}>{r.estado}</Badge>
                </TableCell>
                <TableCell className="flex gap-2">
                  {r.estado === "activa" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingId === r.id}
                        onClick={() => handleReassign(r.id, r.spot_id)}
                      >
                        Reasignar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={loadingId === r.id}
                        onClick={() => handleCancel(r.id)}
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
