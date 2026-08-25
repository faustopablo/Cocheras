"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ChevronLeft, Maximize2, Minimize2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SpotCard } from "@/components/spot-card";
import { ReservationDialog } from "@/components/reservation-dialog";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { FixedSpotReleaseDialog } from "@/components/fixed-spot-release-dialog";
import { cancelFixedSpotReleaseAction } from "@/app/actions/reservations";
import {
  getOwningAssignmentOnDate,
  isSpotReleasedOnDate,
  computeSpotDisplayForDate,
} from "@/lib/spot-status";
import {
  DIAS_SEMANA,
  addDays,
  cn,
  formatDate,
  formatDateShort,
  formatDias,
  hoyArgentina,
  hoyArgentinaDate,
  isSameLocalDate,
  startOfIsoWeek,
  toLocalDateValue,
} from "@/lib/utils";
import type {
  Building,
  FixedSpotAssignment,
  FixedSpotRelease,
  Level,
  ParkingSpot,
  Reservation,
} from "@/lib/database.types";

type Filtro = "todos" | "libres";

export function SpotsBoard({
  buildings,
  levels,
  spots,
  activeReservations,
  fixedSpotAssignments,
  fixedSpotReleases,
  currentUserId,
  ownerNamesByUserId,
}: {
  buildings: Building[];
  levels: Level[];
  spots: ParkingSpot[];
  activeReservations: Reservation[];
  fixedSpotAssignments: FixedSpotAssignment[];
  fixedSpotReleases: FixedSpotRelease[];
  currentUserId: string;
  /** Nombre de cada dueño de cochera fija, por user_id. Solo lo recibe el
   * admin (la página server-side lo trae con la RLS de admin en
   * `profiles`); para el resto de los usuarios no se pasa, así nunca se
   * intenta mostrar nombres de otros colaboradores. */
  ownerNamesByUserId?: Record<string, string>;
}) {
  const router = useRouter();
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingReleaseId, setPendingReleaseId] = useState<string | null>(null);
  // "Hoy" en hora argentina (no la del navegador/servidor): es la fecha
  // contra la que validan las reservas.
  const [selectedDate, setSelectedDate] = useState(() => hoyArgentinaDate());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [expandedBuildings, setExpandedBuildings] = useState<Record<string, boolean>>({});
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({});

  const esHoy = toLocalDateValue(selectedDate) === hoyArgentina();

  // Las reservas son diarias: se indexan por cochera + fecha exacta para
  // poder proyectar cualquier día (no solo hoy) sin aproximaciones.
  const reservationBySpotAndFecha = useMemo(() => {
    const map = new Map<string, Reservation>();
    for (const r of activeReservations) {
      map.set(`${r.spot_id}_${r.fecha}`, r);
    }
    return map;
  }, [activeReservations]);

  const spotsById = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);

  // Mis asignaciones, con sus cocheras. Una cochera fija con varios
  // dueños aparece una vez por cada asignación mía.
  const misAsignaciones = useMemo(
    () =>
      fixedSpotAssignments
        .filter((a) => a.user_id === currentUserId)
        .map((a) => ({ asignacion: a, spot: spotsById.get(a.spot_id) }))
        .filter((x): x is { asignacion: FixedSpotAssignment; spot: ParkingSpot } => !!x.spot),
    [fixedSpotAssignments, currentUserId, spotsById]
  );

  const releasesByAssignment = useMemo(() => {
    const map = new Map<string, FixedSpotRelease[]>();
    for (const r of fixedSpotReleases) {
      const arr = map.get(r.assignment_id) ?? [];
      arr.push(r);
      map.set(r.assignment_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde));
    }
    return map;
  }, [fixedSpotReleases]);

  const levelsByBuilding = useMemo(() => {
    const map = new Map<string, Level[]>();
    for (const l of levels) {
      const arr = map.get(l.building_id) ?? [];
      arr.push(l);
      map.set(l.building_id, arr);
    }
    return map;
  }, [levels]);

  const spotsByLevel = useMemo(() => {
    const map = new Map<string, ParkingSpot[]>();
    for (const s of spots) {
      const arr = map.get(s.level_id) ?? [];
      arr.push(s);
      map.set(s.level_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.codigo.localeCompare(b.codigo));
    }
    return map;
  }, [spots]);

  // Estado/estilo de cada cochera proyectado exactamente para
  // `selectedDate` (las reservas son diarias, así que la proyección de
  // reservas puntuales es exacta para cualquier fecha, no solo hoy).
  const displayBySpotId = useMemo(() => {
    const fechaSeleccionada = toLocalDateValue(selectedDate);
    const map = new Map<string, ReturnType<typeof computeSpotDisplayForDate>>();
    for (const s of spots) {
      map.set(
        s.id,
        computeSpotDisplayForDate(
          s,
          fixedSpotAssignments,
          fixedSpotReleases,
          reservationBySpotAndFecha.get(`${s.id}_${fechaSeleccionada}`),
          currentUserId,
          selectedDate
        )
      );
    }
    return map;
  }, [
    spots,
    fixedSpotAssignments,
    fixedSpotReleases,
    reservationBySpotAndFecha,
    currentUserId,
    selectedDate,
  ]);

  function isBuildingExpanded(id: string) {
    return expandedBuildings[id] ?? true;
  }
  function isLevelExpanded(id: string) {
    return expandedLevels[id] ?? true;
  }
  function toggleBuilding(id: string) {
    setExpandedBuildings((prev) => ({ ...prev, [id]: !isBuildingExpanded(id) }));
  }
  function toggleLevel(id: string) {
    setExpandedLevels((prev) => ({ ...prev, [id]: !isLevelExpanded(id) }));
  }
  function expandirTodo() {
    setExpandedBuildings(Object.fromEntries(buildings.map((b) => [b.id, true])));
    setExpandedLevels(Object.fromEntries(levels.map((l) => [l.id, true])));
  }
  function contraerTodo() {
    setExpandedBuildings(Object.fromEntries(buildings.map((b) => [b.id, false])));
    setExpandedLevels(Object.fromEntries(levels.map((l) => [l.id, false])));
  }

  const semanaDeSeleccion = useMemo(() => startOfIsoWeek(selectedDate), [selectedDate]);

  const totalLibres = useMemo(
    () => spots.filter((s) => displayBySpotId.get(s.id)?.estado === "libre").length,
    [spots, displayBySpotId]
  );

  async function handleCancelarLiberacion(releaseId: string) {
    if (!confirm("¿Cancelar esta liberación? Las reservas que otros hayan hecho dentro del rango no se cancelan automáticamente.")) {
      return;
    }
    setPendingReleaseId(releaseId);
    const res = await cancelFixedSpotReleaseAction(releaseId);
    setPendingReleaseId(null);
    if (res.ok) router.refresh();
    else alert(res.error ?? "No se pudo cancelar la liberación. Volvé a intentarlo.");
  }

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresher
        tables={["parking_spots", "reservations", "fixed_spot_assignments", "fixed_spot_releases"]}
      />

      <BoardToolbar
        selectedDate={selectedDate}
        esHoy={esHoy}
        semanaDeSeleccion={semanaDeSeleccion}
        filtro={filtro}
        onFiltroChange={setFiltro}
        onDateChange={setSelectedDate}
        onExpandirTodo={expandirTodo}
        onContraerTodo={contraerTodo}
      />

      {misAsignaciones.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Mi cochera fija</CardTitle>
            <CardDescription>
              Liberá tus días asignados por un rango de fechas (ej. vacaciones) para que otro
              colaborador pueda reservarlos en ese período.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {misAsignaciones.map(({ asignacion, spot: s }) => {
              const liberadaHoy = isSpotReleasedOnDate(
                fixedSpotAssignments,
                fixedSpotReleases,
                s.id
              );
              const esMiDiaHoy = getOwningAssignmentOnDate(fixedSpotAssignments, s.id)?.id === asignacion.id;
              const liberacionesDeEstaAsignacion = releasesByAssignment.get(asignacion.id) ?? [];
              return (
                <div
                  key={asignacion.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {s.codigo} — {formatDias(asignacion.dias)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {!esMiDiaHoy
                          ? "Hoy no es uno de tus días"
                          : liberadaHoy
                            ? "Liberada hoy — disponible para otros"
                            : "Reservada para vos hoy"}
                      </p>
                    </div>
                    <FixedSpotReleaseDialog
                      assignmentId={asignacion.id}
                      codigo={s.codigo}
                      dias={asignacion.dias}
                    />
                  </div>

                  {liberacionesDeEstaAsignacion.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-border pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Liberaciones programadas
                      </p>
                      {liberacionesDeEstaAsignacion.map((r) => (
                        <div
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card px-3 py-2"
                        >
                          <div className="text-sm">
                            <span className="font-medium">
                              {formatDate(r.fecha_desde)} — {formatDate(r.fecha_hasta)}
                            </span>
                            {r.motivo && <span className="text-muted-foreground"> · {r.motivo}</span>}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pendingReleaseId === r.id}
                            onClick={() => handleCancelarLiberacion(r.id)}
                          >
                            {pendingReleaseId === r.id ? "Cancelando..." : "Cancelar"}
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Si cancelás una liberación en curso, las reservas que ya hayan hecho otros
                        colaboradores dentro de ese rango se mantienen; no se cancelan
                        automáticamente.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {buildings.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">Todavía no hay cocheras cargadas</p>
          <p className="text-sm text-muted-foreground">
            Cuando administración dé de alta los edificios y sus cocheras, vas a poder reservarlas
            desde acá.
          </p>
        </div>
      )}

      {filtro === "libres" && buildings.length > 0 && totalLibres === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <div>
            <p className="text-sm font-semibold text-foreground">
              No hay cocheras libres para el {formatDateShort(selectedDate)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Probá con otra fecha, o mirá el estado completo del día.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setFiltro("todos")}>
            Ver todas las cocheras
          </Button>
        </div>
      )}

      {buildings.map((building) => {
        const buildingSpots = spots.filter((s) => s.building_id === building.id);
        const libresEdificio = buildingSpots.filter(
          (s) => displayBySpotId.get(s.id)?.estado === "libre"
        ).length;
        const buildingLevels = (levelsByBuilding.get(building.id) ?? []).filter(
          (level) => (spotsByLevel.get(level.id) ?? []).length > 0
        );
        if (filtro === "libres" && libresEdificio === 0) return null;
        const expanded = isBuildingExpanded(building.id);

        return (
          <section key={building.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => toggleBuilding(building.id)}
              className="focus-ring flex w-full items-center justify-between gap-3 bg-muted/70 px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                {expanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-comafi-negro-verdoso" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-comafi-negro-verdoso" aria-hidden />
                )}
                <div>
                  <h2 className="text-base font-bold text-foreground sm:text-lg">{building.nombre}</h2>
                  {building.direccion && (
                    <p className="text-xs text-muted-foreground">{building.direccion}</p>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-comafi-verde-claro px-3 py-1 text-xs font-bold text-white">
                Libres: {libresEdificio}
              </span>
            </button>

            {expanded && (
              <div className="flex flex-col gap-3 p-3 sm:p-4">
                {buildingLevels.map((level) => {
                  const levelSpotsAll = spotsByLevel.get(level.id) ?? [];
                  const libresNivel = levelSpotsAll.filter(
                    (s) => displayBySpotId.get(s.id)?.estado === "libre"
                  ).length;
                  const levelSpots =
                    filtro === "libres"
                      ? levelSpotsAll.filter((s) => displayBySpotId.get(s.id)?.estado === "libre")
                      : levelSpotsAll;
                  if (filtro === "libres" && levelSpots.length === 0) return null;
                  const levelExpanded = isLevelExpanded(level.id);

                  return (
                    <div key={level.id} className="overflow-hidden rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => toggleLevel(level.id)}
                        className="focus-ring flex w-full items-center justify-between gap-2 bg-comafi-verde-oscuro px-3 py-2 text-left text-white"
                      >
                        <div className="flex items-center gap-2">
                          {levelExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          )}
                          <h3 className="text-xs font-semibold uppercase tracking-wide sm:text-sm">
                            {level.nombre}
                          </h3>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
                          Libres: {libresNivel}
                        </span>
                      </button>

                      {levelExpanded && (
                        <div className="grid grid-cols-4 gap-2 bg-card p-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                          {levelSpots.map((spot) => {
                            const display =
                              displayBySpotId.get(spot.id) ?? {
                                estado: spot.estado,
                                esMia: false,
                                esReservaPropia: false,
                                reservaActiva: null,
                                esProyeccion: !esHoy,
                                asignacionDelDia: null,
                              };
                            const ownerId = display.asignacionDelDia?.user_id;
                            // Solo el admin recibe `ownerNamesByUserId`, y solo lo
                            // mostramos en "asignada" (dueño de otro, no liberada) y
                            // "libre por liberación del dueño"; en "ocupada" ya hay
                            // una reserva puntual de un tercero que manda, y en "tu
                            // día" el dueño soy yo (ownerId === currentUserId).
                            const ownerName =
                              ownerId &&
                              ownerId !== currentUserId &&
                              (display.estado === "asignada" || display.estado === "libre")
                                ? ownerNamesByUserId?.[ownerId]
                                : undefined;
                            return (
                              <SpotCard
                                key={spot.id}
                                spot={spot}
                                display={display}
                                ownerName={ownerName}
                                onReservar={(s) => {
                                  setSelectedSpot(s);
                                  setDialogOpen(true);
                                }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <ReservationDialog
        key={`${selectedSpot?.id ?? "none"}_${toLocalDateValue(selectedDate)}`}
        spot={selectedSpot}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={selectedDate}
      />
    </div>
  );
}

function BoardToolbar({
  selectedDate,
  esHoy,
  semanaDeSeleccion,
  filtro,
  onFiltroChange,
  onDateChange,
  onExpandirTodo,
  onContraerTodo,
}: {
  selectedDate: Date;
  esHoy: boolean;
  semanaDeSeleccion: Date;
  filtro: Filtro;
  onFiltroChange: (f: Filtro) => void;
  onDateChange: (d: Date) => void;
  onExpandirTodo: () => void;
  onContraerTodo: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Día anterior"
          disabled={toLocalDateValue(selectedDate) <= hoyArgentina()}
          onClick={() => onDateChange(addDays(selectedDate, -1))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>

        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-foreground sm:text-base">
            {formatDateShort(selectedDate)}
          </span>
          <span className="text-xs text-muted-foreground">
            {esHoy ? "Hoy — estado en vivo" : "Disponibilidad proyectada"}
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Día siguiente"
          onClick={() => onDateChange(addDays(selectedDate, 1))}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="flex items-center justify-center gap-1 sm:gap-1.5">
        {DIAS_SEMANA.map((d) => {
          const diaDate = addDays(semanaDeSeleccion, d.value - 1);
          const activo = isSameLocalDate(diaDate, selectedDate);
          // Los días ya pasados de la semana no se pueden reservar.
          const pasado = toLocalDateValue(diaDate) < hoyArgentina();
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => onDateChange(diaDate)}
              disabled={pasado}
              aria-pressed={activo}
              aria-label={pasado ? `${d.label} (fecha pasada)` : d.label}
              className={cn(
                "focus-ring flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold transition-colors sm:h-9 sm:w-9",
                activo
                  ? "bg-comafi-verde-claro text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent",
                pasado && "cursor-not-allowed opacity-40 hover:bg-muted"
              )}
            >
              {d.corta}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 rounded-full bg-muted p-1">
          <button
            type="button"
            onClick={() => onFiltroChange("todos")}
            aria-pressed={filtro === "todos"}
            className={cn(
              "focus-ring rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:py-1.5",
              filtro === "todos"
                ? "bg-comafi-negro-verdoso text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => onFiltroChange("libres")}
            aria-pressed={filtro === "libres"}
            className={cn(
              "focus-ring rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:py-1.5",
              filtro === "libres"
                ? "bg-comafi-verde-claro text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Solo libres
          </button>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onExpandirTodo}>
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            Expandir
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onContraerTodo}>
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
            Contraer
          </Button>
        </div>
      </div>

      <EstadosLeyenda />
    </div>
  );
}

/** Leyenda de colores/estados que se ven en el tablero de cocheras. */
function EstadosLeyenda() {
  const items: { label: string; className: string }[] = [
    { label: "Libre", className: "border-2 border-comafi-verde-claro bg-white" },
    { label: "Tu día / tu reserva", className: "bg-comafi-verde-claro" },
    { label: "Asignada (fija, no liberada)", className: "bg-comafi-verde-oscuro" },
    { label: "Ocupada (reserva activa)", className: "bg-comafi-negro-verdoso" },
    { label: "Fuera de servicio", className: "border-2 border-border bg-muted" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-3 w-3 shrink-0 rounded-full", item.className)} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}
