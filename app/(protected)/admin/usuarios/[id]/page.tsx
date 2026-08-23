import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  CocherasFijasSection,
  HistorialReservasSection,
  type AssignmentWithSpot,
  type ReservationWithSpot,
} from "@/components/user-profile-sections";
import type { EstadoReserva, FixedSpotRelease, Jerarquia, Profile, Rol } from "@/lib/database.types";

export const metadata = { title: "Ficha de usuario — Admin Cocheras Comafi" };

const RESERVAS_POR_PAGINA = 20;

const ROL_LABEL: Record<Rol, string> = {
  admin: "Admin",
  colaborador: "Colaborador",
};

const JERARQUIA_LABEL: Record<Jerarquia, string> = {
  directivo: "Directivo",
  gerente: "Gerente",
  colaborador: "Colaborador",
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
        .order("fecha", { ascending: false })
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

      <CocherasFijasSection
        titulo="Cocheras fijas asignadas"
        descripcion="Días de la semana y liberaciones programadas de cada cochera fija a su nombre."
        mensajeVacio="No tiene cocheras fijas asignadas actualmente."
        assignments={assignmentsList}
        releasesByAssignment={releasesByAssignment}
      />

      <HistorialReservasSection
        resumen={resumen}
        reservations={reservationsList}
        hayMasReservas={hayMasReservas}
        verMasHref={`/admin/usuarios/${id}?limit=${limit + RESERVAS_POR_PAGINA}`}
        mensajeVacio="Todavía no hizo ninguna reserva."
      />
    </div>
  );
}
