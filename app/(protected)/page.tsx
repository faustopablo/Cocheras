import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SpotsBoard } from "@/components/spots-board";
import { hoyArgentina } from "@/lib/utils";
import type {
  ActiveReservationBoardRow,
  Building,
  FixedSpotAssignment,
  FixedSpotRelease,
  Level,
  ParkingSpot,
} from "@/lib/database.types";

export const metadata = { title: "Cocheras — Cocheras Comafi" };

export default async function HomePage() {
  const { user } = await requireUser();
  const supabase = await createClient();

  const [
    { data: buildings },
    { data: levels },
    { data: spots },
    { data: reservations },
    { data: assignments },
    { data: releases },
  ] = await Promise.all([
    supabase.from("buildings").select("*").eq("activo", true).order("nombre"),
    supabase.from("levels").select("*").order("nombre"),
    supabase.from("parking_spots").select("*").order("codigo"),
    // Ocupación de TODOS los usuarios (no solo la propia): se lee de la
    // vista pública `active_reservations_board` (migración 0010), en vez
    // de la tabla `reservations` directamente. La RLS de `reservations`
    // (intencional) solo deja leer la reserva propia o, si sos admin,
    // cualquiera; consultar la tabla acá hacía que el mapa mostrara como
    // libre una cochera que otro colaborador ya había reservado ese día
    // (bug real: Axel reserva la 81, a Sofía le figuraba libre, y si
    // intentaba reservarla el trigger anti-solapamiento la rechazaba con
    // un mensaje que no explicaba el motivo real). La vista expone solo
    // spot_id + fecha + estado ('activa') + user_id + es_invitado de
    // TODAS las reservas activas, sin datos de guests ni historial.
    supabase.from("active_reservations_board").select("*"),
    supabase.from("fixed_spot_assignments").select("*"),
    // Solo se necesitan las liberaciones activas y no vencidas: alcanzan
    // para calcular disponibilidad de hoy y para listar las programadas.
    supabase
      .from("fixed_spot_releases")
      .select("*")
      .eq("estado", "activa")
      .gte("fecha_hasta", hoyArgentina())
      .order("fecha_desde"),
  ]);

  // Todos los usuarios ven el nombre de quien ocupa cada cochera en el
  // mapa: dueños de cocheras fijas y colaboradores con una reserva puntual
  // activa. Se lee de la vista pública `user_display_names` (migración
  // 0010, superconjunto de `owner_names` de 0009), que solo expone
  // id+nombre de usuarios efectivamente involucrados en alguna ocupación
  // (no email/rol/jerarquía, y no el resto de los usuarios del banco).
  // Las reservas de invitados (user_id null) no necesitan esta consulta:
  // el mapa les muestra directamente la etiqueta "Invitado".
  let userDisplayNamesByUserId: Record<string, string> | undefined;
  const involvedUserIds = Array.from(
    new Set([
      ...(assignments ?? []).map((a) => a.user_id),
      ...(reservations ?? []).flatMap((r) => (r.user_id ? [r.user_id] : [])),
    ])
  );
  if (involvedUserIds.length > 0) {
    const { data: names } = await supabase
      .from("user_display_names")
      .select("user_id, nombre")
      .in("user_id", involvedUserIds);
    userDisplayNamesByUserId = Object.fromEntries(
      (names ?? []).map((n) => [n.user_id as string, n.nombre as string])
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cocheras disponibles</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Estado en vivo por edificio y subsuelo; los cambios de otros usuarios se reflejan
          automáticamente. Las reservas son por día completo: elegí otra fecha para ver la
          disponibilidad exacta de ese día.
        </p>
      </div>
      <SpotsBoard
        buildings={(buildings ?? []) as Building[]}
        levels={(levels ?? []) as Level[]}
        spots={(spots ?? []) as ParkingSpot[]}
        activeReservations={(reservations ?? []) as ActiveReservationBoardRow[]}
        fixedSpotAssignments={(assignments ?? []) as FixedSpotAssignment[]}
        fixedSpotReleases={(releases ?? []) as FixedSpotRelease[]}
        currentUserId={user.id}
        userDisplayNamesByUserId={userDisplayNamesByUserId}
      />
    </div>
  );
}
