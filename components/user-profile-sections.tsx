import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, DIAS_SEMANA, formatDate } from "@/lib/utils";
import type {
  Building,
  EstadoLiberacion,
  EstadoReserva,
  FixedSpotAssignment,
  FixedSpotRelease,
  Level,
  OrigenReserva,
  ParkingSpot,
  Reservation,
  Rol,
} from "@/lib/database.types";

export const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  asistente: "Asistente",
  colaborador: "Colaborador",
};

export const ESTADO_RESERVA_VARIANT: Record<EstadoReserva, "success" | "muted" | "destructive" | "warning"> = {
  activa: "success",
  completada: "muted",
  cancelada: "destructive",
  no_show: "warning",
};

export const ESTADO_RESERVA_LABEL: Record<EstadoReserva, string> = {
  activa: "Activa",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No-show",
};

export const ORIGEN_LABEL: Record<OrigenReserva, string> = {
  libre: "Libre",
  fija_liberada: "Fija liberada",
  invitado: "Invitado",
};

export const ESTADO_LIBERACION_VARIANT: Record<EstadoLiberacion, "success" | "muted"> = {
  activa: "success",
  cancelada: "muted",
};

export type AssignmentWithSpot = FixedSpotAssignment & {
  spot?: ParkingSpot & { building?: Building; level?: Level };
};

export type ReservationWithSpot = Reservation & {
  spot?: ParkingSpot & { building?: Building };
};

export type ResumenReservas = {
  total: number;
  completadas: number;
  canceladas: number;
  noShow: number;
};

/** Chips de días de la semana (solo lectura) para mostrar en asignaciones fijas. */
export function DiasChipsReadonly({ dias }: { dias: number[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DIAS_SEMANA.map((d) => {
        const seleccionado = dias.includes(d.value);
        return (
          <span
            key={d.value}
            title={d.label}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
              seleccionado
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted text-muted-foreground"
            )}
          >
            {d.corta}
          </span>
        );
      })}
    </div>
  );
}

export function ResumenChip({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: number;
  variant?: "default" | "muted" | "destructive" | "warning";
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <Badge variant={variant} className="font-normal">
        {label}
      </Badge>
    </div>
  );
}

/** Sección "Cocheras fijas": asignaciones y sus liberaciones programadas. */
export function CocherasFijasSection({
  titulo,
  descripcion,
  mensajeVacio,
  assignments,
  releasesByAssignment,
}: {
  titulo: string;
  descripcion: string;
  mensajeVacio: string;
  assignments: AssignmentWithSpot[];
  releasesByAssignment: Map<string, FixedSpotRelease[]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{mensajeVacio}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {assignments.map((a) => (
              <div key={a.id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {a.spot?.codigo ?? "Cochera"}
                      {a.spot?.building && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {a.spot.building.nombre}
                          {a.spot.level && ` · ${a.spot.level.nombre}`}
                        </span>
                      )}
                    </p>
                  </div>
                  <DiasChipsReadonly dias={a.dias} />
                </div>

                {(releasesByAssignment.get(a.id) ?? []).length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Liberaciones programadas
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {(releasesByAssignment.get(a.id) ?? []).map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant={ESTADO_LIBERACION_VARIANT[r.estado]}>
                            {r.estado === "activa" ? "Activa" : "Cancelada"}
                          </Badge>
                          <span>
                            {formatDate(r.fecha_desde)} — {formatDate(r.fecha_hasta)}
                          </span>
                          {r.motivo && <span className="text-muted-foreground">({r.motivo})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Sección "Historial de reservas": resumen + tabla con paginación "Mostrar más". */
export function HistorialReservasSection({
  resumen,
  reservations,
  hayMasReservas,
  verMasHref,
  mensajeVacio,
}: {
  resumen: ResumenReservas;
  reservations: ReservationWithSpot[];
  hayMasReservas: boolean;
  verMasHref: string;
  mensajeVacio: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de reservas</CardTitle>
        <div className="flex flex-wrap gap-3 pt-2">
          <ResumenChip label="Total" value={resumen.total} />
          <ResumenChip label="Completadas" value={resumen.completadas} variant="muted" />
          <ResumenChip label="Canceladas" value={resumen.canceladas} variant="destructive" />
          <ResumenChip label="No-show" value={resumen.noShow} variant="warning" />
        </div>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{mensajeVacio}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cochera</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.spot?.codigo}
                      {r.spot?.building && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({r.spot.building.nombre})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(r.fecha)}</TableCell>
                    <TableCell>{ORIGEN_LABEL[r.origen]}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_RESERVA_VARIANT[r.estado]}>
                        {ESTADO_RESERVA_LABEL[r.estado]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hayMasReservas && (
              <div className="mt-4 flex justify-center">
                <Button asChild variant="outline" size="sm">
                  <Link href={verMasHref}>Mostrar más</Link>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
