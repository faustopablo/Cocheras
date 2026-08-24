import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import {
  CocherasFijasSection,
  HistorialReservasSection,
  type AssignmentWithSpot,
  type ReservationWithSpot,
} from "@/components/user-profile-sections";
import type { EstadoReserva, FixedSpotRelease, Jerarquia, Rol } from "@/lib/database.types";

export const metadata = { title: "Mi perfil — Cocheras Comafi" };

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

export default async function MiPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const { limit: limitParam } = await searchParams;
  const limit = Math.max(RESERVAS_POR_PAGINA, Number(limitParam) || RESERVAS_POR_PAGINA);

  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: assignments }, { data: reservationEstados }, { data: reservations }] =
    await Promise.all([
      supabase
        .from("fixed_spot_assignments")
        .select("*, spot:parking_spots(*, building:buildings(*), level:levels(*))")
        .eq("user_id", profile.id),
      supabase.from("reservations").select("estado").eq("user_id", profile.id),
      supabase
        .from("reservations")
        .select("*, spot:parking_spots(*, building:buildings(*))")
        .eq("user_id", profile.id)
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{profile.nombre}</CardTitle>
          <CardDescription>{profile.email}</CardDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={profile.rol === "admin" ? "default" : "secondary"}>
              {profile.rol === "admin" && <ShieldCheck className="mr-1 h-3 w-3" />}
              {ROL_LABEL[profile.rol]}
            </Badge>
            <Badge variant="outline">{JERARQUIA_LABEL[profile.jerarquia]}</Badge>
            <span className="text-xs text-muted-foreground">
              Alta: {formatDate(profile.created_at)}
            </span>
          </div>
        </CardHeader>
      </Card>

      <CocherasFijasSection
        titulo="Mis cocheras fijas"
        descripcion="Días de la semana y liberaciones programadas de tus cocheras fijas."
        mensajeVacio="No tenés cocheras fijas asignadas actualmente."
        assignments={assignmentsList}
        releasesByAssignment={releasesByAssignment}
      />

      <HistorialReservasSection
        resumen={resumen}
        reservations={reservationsList}
        hayMasReservas={hayMasReservas}
        verMasHref={`/perfil?limit=${limit + RESERVAS_POR_PAGINA}`}
        mensajeVacio="Todavía no hiciste ninguna reserva."
      />
    </div>
  );
}
