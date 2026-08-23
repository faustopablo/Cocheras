"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/utils";
import { checkInAction, checkOutAction, cancelReservationAction } from "@/app/actions/reservations";
import type { ReservationWithRelations, EstadoReserva } from "@/lib/database.types";

const ESTADO_VARIANT: Record<EstadoReserva, "success" | "muted" | "destructive" | "warning"> = {
  activa: "success",
  completada: "muted",
  cancelada: "destructive",
  no_show: "warning",
};

const ESTADO_LABEL: Record<EstadoReserva, string> = {
  activa: "Activa",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No-show",
};

export function ReservationsList({
  activas,
  historial,
}: {
  activas: ReservationWithRelations[];
  historial: ReservationWithRelations[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function run(id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setLoadingId(id);
    const res = await fn(id);
    setLoadingId(null);
    if (res.ok) router.refresh();
    else alert(res.error ?? "Ocurrió un error.");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Reservas activas</CardTitle>
        </CardHeader>
        <CardContent>
          {activas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenés reservas activas.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activas.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">
                      {r.spot?.codigo} · {r.spot?.building?.nombre}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDate(r.fecha)}</p>
                    <p className="text-xs text-muted-foreground">
                      Check-in: {r.check_in_at ? formatDateTime(r.check_in_at) : "pendiente"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!r.check_in_at && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={loadingId === r.id}
                        onClick={() => run(r.id, checkInAction)}
                      >
                        Check-in
                      </Button>
                    )}
                    {r.check_in_at && !r.check_out_at && (
                      <Button
                        size="sm"
                        disabled={loadingId === r.id}
                        onClick={() => run(r.id, checkOutAction)}
                      >
                        Check-out
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === r.id}
                      onClick={() => run(r.id, cancelReservationAction)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no tenés historial.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cochera</TableHead>
                  <TableHead>Edificio</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.spot?.codigo}</TableCell>
                    <TableCell>{r.spot?.building?.nombre}</TableCell>
                    <TableCell>{formatDate(r.fecha)}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[r.estado]}>{ESTADO_LABEL[r.estado]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
