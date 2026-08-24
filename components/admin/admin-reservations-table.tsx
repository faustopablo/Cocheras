"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import {
  ESTADO_RESERVA_LABEL,
  ESTADO_RESERVA_VARIANT,
  ORIGEN_LABEL,
} from "@/components/user-profile-sections";
import {
  adminCancelReservationAction,
  adminReassignReservationAction,
} from "@/app/actions/admin-reservations";
import type { ParkingSpot, ReservationWithRelations } from "@/lib/database.types";

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
  const [reassigning, setReassigning] = useState<ReservationWithRelations | null>(null);

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

  const hayFiltrosActivos = filtroEstado !== "todas" || filtroBuilding !== "todos";

  async function handleCancel(r: ReservationWithRelations) {
    const titular = r.user?.nombre ?? r.guest?.nombre ?? "el titular";
    if (!confirm(`¿Cancelar la reserva de ${r.spot?.codigo} (${titular}) del ${formatDate(r.fecha)}?`)) {
      return;
    }
    setLoadingId(r.id);
    const res = await adminCancelReservationAction(r.id);
    setLoadingId(null);
    if (res.ok) router.refresh();
    else alert(res.error ?? "No se pudo cancelar la reserva. Volvé a intentarlo.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservas</CardTitle>
        <div className="flex flex-wrap gap-3 pt-2">
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-44" aria-label="Filtrar por estado">
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
            <SelectTrigger className="w-52" aria-label="Filtrar por edificio">
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
        {filtradas.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {hayFiltrosActivos
                ? "Ninguna reserva coincide con los filtros elegidos."
                : "Todavía no hay reservas registradas en la organización."}
            </p>
            {hayFiltrosActivos && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiltroEstado("todas");
                  setFiltroBuilding("todos");
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cochera</TableHead>
                <TableHead>Edificio</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.spot?.codigo}</TableCell>
                  <TableCell>{r.spot?.building?.nombre}</TableCell>
                  <TableCell>{r.user?.nombre ?? r.guest?.nombre ?? "-"}</TableCell>
                  <TableCell>{ORIGEN_LABEL[r.origen]}</TableCell>
                  <TableCell>{formatDate(r.fecha)}</TableCell>
                  <TableCell>
                    <Badge variant={ESTADO_RESERVA_VARIANT[r.estado]}>
                      {ESTADO_RESERVA_LABEL[r.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.estado === "activa" && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingId === r.id}
                          onClick={() => setReassigning(r)}
                        >
                          Reasignar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={loadingId === r.id}
                          onClick={() => handleCancel(r)}
                        >
                          {loadingId === r.id ? "Cancelando..." : "Cancelar"}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <ReassignDialog
        key={reassigning?.id ?? "none"}
        reservation={reassigning}
        spots={spots}
        onOpenChange={(open) => {
          if (!open) setReassigning(null);
        }}
      />
    </Card>
  );
}

/** Diálogo para mover una reserva activa a otra cochera libre. */
function ReassignDialog({
  reservation,
  spots,
  onOpenChange,
}: {
  reservation: ReservationWithRelations | null;
  spots: ParkingSpot[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [newSpotId, setNewSpotId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reservation) return null;

  const libres = spots.filter((s) => s.estado === "libre" && s.id !== reservation.spot_id);

  async function handleConfirm() {
    if (!reservation) return;
    if (!newSpotId) {
      setError("Elegí la cochera destino.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await adminReassignReservationAction({
      reservationId: reservation.id,
      newSpotId,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo reasignar la reserva. Volvé a intentarlo.");
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reasignar reserva de {reservation.spot?.codigo}</DialogTitle>
          <DialogDescription>
            {reservation.user?.nombre ?? reservation.guest?.nombre ?? "El titular"} conserva la
            reserva del {formatDate(reservation.fecha)}, pero en la cochera que elijas.
          </DialogDescription>
        </DialogHeader>

        {libres.length === 0 ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            No hay cocheras libres disponibles para reasignar en este momento.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="reasignar-destino">Cochera destino</Label>
            <Select value={newSpotId} onValueChange={setNewSpotId}>
              <SelectTrigger id="reasignar-destino">
                <SelectValue placeholder="Elegir cochera libre" />
              </SelectTrigger>
              <SelectContent>
                {libres.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || libres.length === 0}>
            {saving ? "Reasignando..." : "Confirmar reasignación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
