import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReservationsList } from "@/components/reservations-list";
import { CocherasFijasSection, type AssignmentWithSpot } from "@/components/user-profile-sections";
import type { FixedSpotRelease, ReservationWithRelations } from "@/lib/database.types";

export const metadata = { title: "Mis reservas — Cocheras Comafi" };

export default async function ReservasPage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const [{ data }, { data: assignments }] = await Promise.all([
    supabase
      .from("reservations")
      .select("*, spot:parking_spots(*, building:buildings(*), level:levels(*))")
      .eq("user_id", user.id)
      .order("fecha", { ascending: false }),
    supabase
      .from("fixed_spot_assignments")
      .select("*, spot:parking_spots(*, building:buildings(*), level:levels(*))")
      .eq("user_id", user.id),
  ]);

  const reservas = (data ?? []) as ReservationWithRelations[];
  const activas = reservas.filter((r) => r.estado === "activa");
  const historial = reservas.filter((r) => r.estado !== "activa");

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mis reservas</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Consultá tus reservas del día y cancelalas si cambian tus planes.
        </p>
      </div>
      {/*
       * A diferencia de /perfil, si el usuario no tiene cocheras fijas ocultamos
       * la sección entera en vez de mostrar el mensaje de estado vacío: acá el
       * foco es la reserva del día y un cartel vacío no aporta, solo agrega ruido.
       */}
      {assignmentsList.length > 0 && (
        <CocherasFijasSection
          titulo="Mis cocheras fijas"
          descripcion="Días de la semana y liberaciones programadas de tus cocheras fijas."
          mensajeVacio=""
          assignments={assignmentsList}
          releasesByAssignment={releasesByAssignment}
        />
      )}
      <ReservationsList activas={activas} historial={historial} />
    </div>
  );
}
