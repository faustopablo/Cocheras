"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { ESTADO_RESERVA_LABEL, ESTADO_RESERVA_VARIANT } from "@/components/user-profile-sections";
import { cancelReservationAction } from "@/app/actions/reservations";
import type { ReservationWithRelations } from "@/lib/database.types";

export function ReservationsList({
  activas,
  historial,
}: {
  activas: ReservationWithRelations[];
  historial: ReservationWithRelations[];
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleCancelar(r: ReservationWithRelations) {
    if (!confirm(`¿Cancelar tu reserva de ${r.spot?.codigo} del ${formatDate(r.fecha)}?`)) return;
    setLoadingId(r.id);
    const res = await cancelReservationAction(r.id);
    setLoadingId(null);
    if (res.ok) router.refresh();
    else alert(res.error ?? "No se pudo cancelar la reserva. Volvé a intentarlo.");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Reservas activas</CardTitle>
        </CardHeader>
        <CardContent>
          {activas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No tenés reservas activas. Elegí una cochera libre en el mapa para reservarla.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/">Ir al mapa de cocheras</Link>
              </Button>
            </div>
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
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === r.id}
                      onClick={() => handleCancelar(r)}
                    >
                      {loadingId === r.id ? "Cancelando..." : "Cancelar"}
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
            <p className="text-sm text-muted-foreground">
              Todavía no tenés historial: tus reservas completadas o canceladas van a aparecer acá.
            </p>
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
                      <Badge variant={ESTADO_RESERVA_VARIANT[r.estado]}>
                        {ESTADO_RESERVA_LABEL[r.estado]}
                      </Badge>
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
