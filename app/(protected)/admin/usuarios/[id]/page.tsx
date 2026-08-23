import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, DIAS_SEMANA, formatDate, formatDateTime } from "@/lib/utils";
import type {
  Building,
  EstadoLiberacion,
  EstadoReserva,
  FixedSpotAssignment,
  FixedSpotRelease,
  Jerarquia,
  Level,
  OrigenReserva,
  ParkingSpot,
  Profile,
  Rol,
  Reservation,
} from "@/lib/database.types";

export const metadata = { title: "Ficha de usuario — Admin Cocheras Comafi" };

const RESERVAS_POR_PAGINA = 20;

const ESTADO_RESERVA_VARIANT: Record<EstadoReserva, "success" | "muted" | "destructive" | "warning"> = {
  activa: "success",
  completada: "muted",
  cancelada: "destructive",
  no_show: "warning",
};

const ESTADO_RESERVA_LABEL: Record<EstadoReserva, string> = {
  activa: "Activa",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No-show",
};

const ORIGEN_LABEL: Record<OrigenReserva, string> = {
  libre: "Libre",
  fija_liberada: "Fija liberada",
  invitado: "Invitado",
};

const ESTADO_LIBERACION_VARIANT: Record<EstadoLiberacion, "success" | "muted"> = {
  activa: "success",
  cancelada: "muted",
};

const ROL_LABEL: Record<Rol, string> = {
  admin: "Admin",
  colaborador: "Colaborador",
};

const JERARQUIA_LABEL: Record<Jerarquia, string> = {
  directivo: "Directivo",
  gerente: "Gerente",
  colaborador: "Colaborador",
};

type AssignmentWithSpot = FixedSpotAssignment & {
  spot?: ParkingSpot & { building?: Building; level?: Level };
};

type ReservationWithSpot = Reservation & {
  spot?: ParkingSpot & { building?: Building };
};

export default async function AdminUsuarioDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  const { id } = await params;
  const { limit: limitParam } = await searchParams;
  const limit = Math.max(RESERVAS_POR_PAGINA, Number(limitParam) || RESERVAS_POR_PAGINA);

  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();

  if (!profile) {
    notFound();
  }

  const [{ data: assignments }, { data: reservationEstados }, { data: reservations }] =
    await Promise.all([
      supabase
        .from("fixed_spot_assignments")
        .select("*, spot:parking_spots(*, building:buildings(*), level:levels(*))")
        .eq("user_id", id),
      supabase.from("reservations").select("estado").eq("user_id", id),
      supabase
        .from("reservations")
        .select("*, spot:parking_spots(*, building:buildings(*))")
        .eq("user_id", id)
        .order("fecha_inicio", { ascending: false })
        .limit(limit),
    ]);

  const assignmentsList = (assignments ?? []) as AssignmentWithSpot[];
  const assignmentIds = assignmentsList.map((a) => a.id);

  const { data: releases } = assignmentIds.length
    ? await supabase
        .from("fixed_spot_releases")
        .select("*")
        .in("assignment_id", assignmentIds)
        .order("fecha_desde", { ascending: false })
    : { data: [] as FixedSpotRelease[] };

  const releasesByAssignment = new Map<string, FixedSpotRelease[]>();
  (releases ?? []).forEach((r) => {
    const list = releasesByAssignment.get(r.assignment_id) ?? [];
    list.push(r);
    releasesByAssignment.set(r.assignment_id, list);
  });

  const estados = (reservationEstados ?? []) as { estado: EstadoReserva }[];
  const totalReservas = estados.length;
  const resumen = {
    total: totalReservas,
    completadas: estados.filter((r) => r.estado === "completada").length,
    canceladas: estados.filter((r) => r.estado === "cancelada").length,
    noShow: estados.filter((r) => r.estado === "no_show").length,
  };

  const reservationsList = (reservations ?? []) as ReservationWithSpot[];
  const hayMasReservas = totalReservas > reservationsList.length;

  const p = profile as Profile;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/usuarios"
        className="focus-ring inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Usuarios
      </Link>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 sm:items-center">
          <div>
            <CardTitle className="text-2xl">{p.nombre}</CardTitle>
            <CardDescription>{p.email}</CardDescription>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={p.rol === "admin" ? "default" : "secondary"}>{ROL_LABEL[p.rol]}</Badge>
              <Badge variant="outline">{JERARQUIA_LABEL[p.jerarquia]}</Badge>
              {p.activo ? (
                <Badge variant="success">Activo</Badge>
              ) : (
                <Badge variant="muted">Inactivo</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Alta: {formatDate(p.created_at)}
              </span>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/usuarios">Editar en el listado</Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cocheras fijas asignadas</CardTitle>
          <CardDescription>
            Días de la semana y liberaciones programadas de cada cochera fija a su nombre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tiene cocheras fijas asignadas actualmente.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {assignmentsList.map((a) => (
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
                            {r.motivo && (
                              <span className="text-muted-foreground">({r.motivo})</span>
                            )}
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
          {reservationsList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hizo ninguna reserva.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cochera</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Fin</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservationsList.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.spot?.codigo}
                        {r.spot?.building && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({r.spot.building.nombre})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(r.fecha_inicio)}</TableCell>
                      <TableCell>{formatDateTime(r.fecha_fin)}</TableCell>
                      <TableCell>{ORIGEN_LABEL[r.origen]}</TableCell>
                      <TableCell>
                        <Badge variant={ESTADO_RESERVA_VARIANT[r.estado]}>
                          {ESTADO_RESERVA_LABEL[r.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(r.check_in_at)}</TableCell>
                      <TableCell>{formatDateTime(r.check_out_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {hayMasReservas && (
                <div className="mt-4 flex justify-center">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/usuarios/${id}?limit=${limit + RESERVAS_POR_PAGINA}`}>
                      Mostrar más
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DiasChipsReadonly({ dias }: { dias: number[] }) {
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
                : "border-border bg-muted text-muted-foreground opacity-50"
            )}
          >
            {d.corta}
          </span>
        );
      })}
    </div>
  );
}

function ResumenChip({
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
