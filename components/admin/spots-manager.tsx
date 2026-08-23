"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createSpotAction,
  updateSpotAction,
  deleteSpotAction,
  createFixedSpotAssignmentAction,
  updateFixedSpotAssignmentAction,
  deleteFixedSpotAssignmentAction,
} from "@/app/actions/admin-buildings";
import { DIAS_SEMANA, cn, formatDias } from "@/lib/utils";
import type {
  Building,
  EstadoCochera,
  FixedSpotAssignment,
  Level,
  ParkingSpot,
  Profile,
  TipoCochera,
} from "@/lib/database.types";

const ESTADOS: EstadoCochera[] = ["libre", "ocupada", "bloqueada", "fuera_de_servicio"];
const ALL = "all";

export function SpotsManager({
  buildings,
  levels,
  spots,
  profiles,
  assignments,
}: {
  buildings: Building[];
  levels: Level[];
  spots: ParkingSpot[];
  profiles: Profile[];
  assignments: FixedSpotAssignment[];
}) {
  const searchParams = useSearchParams();
  const [buildingFilter, setBuildingFilter] = useState<string>(
    searchParams.get("edificio") ?? ALL
  );
  const [levelFilter, setLevelFilter] = useState<string>(ALL);

  const filteredLevels = useMemo(
    () => levels.filter((l) => buildingFilter === ALL || l.building_id === buildingFilter),
    [levels, buildingFilter]
  );

  const filteredSpots = useMemo(
    () =>
      spots.filter((s) => {
        if (buildingFilter !== ALL && s.building_id !== buildingFilter) return false;
        if (levelFilter !== ALL && s.level_id !== levelFilter) return false;
        return true;
      }),
    [spots, buildingFilter, levelFilter]
  );

  const assignmentsBySpot = useMemo(() => {
    const map = new Map<string, FixedSpotAssignment[]>();
    for (const a of assignments) {
      const arr = map.get(a.spot_id) ?? [];
      arr.push(a);
      map.set(a.spot_id, arr);
    }
    return map;
  }, [assignments]);

  const selectedBuilding = buildings.find((b) => b.id === buildingFilter);
  const selectedLevel = levels.find((l) => l.id === levelFilter && l.building_id === buildingFilter);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label>Edificio</Label>
              <Select
                value={buildingFilter}
                onValueChange={(v) => {
                  setBuildingFilter(v);
                  setLevelFilter(ALL);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los edificios</SelectItem>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Subsuelo</Label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los subsuelos</SelectItem>
                  {filteredLevels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBuilding && selectedLevel && (
              <SpotFormDialog building={selectedBuilding} level={selectedLevel} />
            )}
          </div>
          {(!selectedBuilding || !selectedLevel) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Elegí un edificio y un subsuelo específicos para poder agregar una cochera nueva.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cocheras ({filteredSpots.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSpots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cocheras que coincidan con el filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Edificio</TableHead>
                  <TableHead>Subsuelo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prereservada</TableHead>
                  <TableHead>Asignaciones</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSpots.map((spot) => {
                  const building = buildings.find((b) => b.id === spot.building_id);
                  const level = levels.find((l) => l.id === spot.level_id);
                  if (!building || !level) return null;
                  return (
                    <SpotRow
                      key={spot.id}
                      spot={spot}
                      building={building}
                      level={level}
                      profiles={profiles}
                      assignments={assignmentsBySpot.get(spot.id) ?? []}
                    />
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SpotRow({
  spot,
  building,
  level,
  profiles,
  assignments,
}: {
  spot: ParkingSpot;
  building: Building;
  level: Level;
  profiles: Profile[];
  assignments: FixedSpotAssignment[];
}) {
  const router = useRouter();
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  async function handleDelete() {
    if (!confirm(`¿Eliminar la cochera ${spot.codigo}?`)) return;
    const res = await deleteSpotAction(spot.id);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{spot.codigo}</TableCell>
      <TableCell>{building.nombre}</TableCell>
      <TableCell>{level.nombre}</TableCell>
      <TableCell>{spot.tipo === "fija" ? "Fija" : "Libre"}</TableCell>
      <TableCell>{spot.es_prereservada ? "Sí" : "No"}</TableCell>
      <TableCell>
        {spot.tipo !== "fija" ? (
          "-"
        ) : assignments.length === 0 ? (
          <span className="text-muted-foreground">Sin asignar (libre todos los días)</span>
        ) : (
          <div className="flex flex-col gap-1">
            {assignments.map((a) => (
              <span key={a.id} className="text-xs">
                <span className="font-medium">{profileById.get(a.user_id)?.nombre ?? "Desconocido"}</span>
                {" · "}
                {formatDias(a.dias)}
              </span>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{spot.estado}</Badge>
      </TableCell>
      <TableCell className="flex gap-2">
        <SpotFormDialog
          building={building}
          level={level}
          spot={spot}
          profiles={profiles}
          assignments={assignments}
        />
        <Button size="sm" variant="ghost" onClick={handleDelete}>
          Eliminar
        </Button>
      </TableCell>
    </TableRow>
  );
}

function SpotFormDialog({
  building,
  level,
  spot,
  profiles,
  assignments,
}: {
  building: Building;
  level: Level;
  spot?: ParkingSpot;
  profiles?: Profile[];
  assignments?: FixedSpotAssignment[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState(spot?.codigo ?? "");
  const [tipo, setTipo] = useState<TipoCochera>(spot?.tipo ?? "libre");
  const [esPrereservada, setEsPrereservada] = useState(spot?.es_prereservada ?? false);
  const [estado, setEstado] = useState<EstadoCochera>(spot?.estado ?? "libre");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const result = spot
      ? await updateSpotAction({ id: spot.id, codigo, tipo, esPrereservada, estado })
      : await createSpotAction({ buildingId: building.id, levelId: level.id, codigo, tipo, esPrereservada });

    setSaving(false);
    if (result.ok) {
      if (!spot) setOpen(false);
      router.refresh();
    } else {
      alert(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={spot ? "outline" : "default"}>
          {spot ? "Editar" : "Agregar cochera"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {spot ? `Editar ${spot.codigo}` : `Nueva cochera en ${building.nombre} — ${level.nombre}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Código</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCochera)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="libre">Libre</SelectItem>
                <SelectItem value="fija">Fija</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {spot && (
            <div>
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoCochera)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tipo === "fija" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  En cocheras fijas este campo solo importa para marcarla &quot;fuera de servicio&quot;.
                  La disponibilidad para que otros la reserven se calcula sola: los días de la
                  semana sin dueño asignado quedan libres, y los días con dueño se liberan cuando
                  el titular crea una liberación por rango de fechas desde &quot;Mi cochera fija&quot;.
                </p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch id="prereservada" checked={esPrereservada} onCheckedChange={setEsPrereservada} />
            <Label htmlFor="prereservada">Es prereservada</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>

        {spot && tipo === "fija" && profiles && (
          <FixedSpotAssignmentsManager
            spotId={spot.id}
            profiles={profiles}
            assignments={assignments ?? []}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FixedSpotAssignmentsManager({
  spotId,
  profiles,
  assignments,
}: {
  spotId: string;
  profiles: Profile[];
  assignments: FixedSpotAssignment[];
}) {
  const router = useRouter();
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const diasOcupados = useMemo(() => new Set(assignments.flatMap((a) => a.dias)), [assignments]);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-sm font-semibold text-foreground">Asignaciones por día</p>
      <p className="text-xs text-muted-foreground">
        Los días de la semana que no tengan ningún colaborador asignado quedan disponibles para
        que cualquiera los reserve.
      </p>

      {assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Todavía no hay ninguna asignación.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {assignments.map((a) => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              nombre={profileById.get(a.user_id)?.nombre ?? "Desconocido"}
              diasOcupadosPorOtros={new Set(
                assignments.filter((o) => o.id !== a.id).flatMap((o) => o.dias)
              )}
              onSaved={() => router.refresh()}
            />
          ))}
        </div>
      )}

      <NewAssignmentForm
        spotId={spotId}
        profiles={profiles}
        diasOcupados={diasOcupados}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function AssignmentRow({
  assignment,
  nombre,
  diasOcupadosPorOtros,
  onSaved,
}: {
  assignment: FixedSpotAssignment;
  nombre: string;
  diasOcupadosPorOtros: Set<number>;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [dias, setDias] = useState<number[]>(assignment.dias);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGuardar() {
    setSaving(true);
    setError(null);
    const res = await updateFixedSpotAssignmentAction({
      id: assignment.id,
      userId: assignment.user_id,
      dias,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar.");
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function handleEliminar() {
    if (!confirm(`¿Quitar la asignación de ${nombre}?`)) return;
    setSaving(true);
    const res = await deleteFixedSpotAssignmentAction(assignment.id);
    setSaving(false);
    if (res.ok) onSaved();
    else alert(res.error);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{nombre}</span>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDias(assignment.dias); setError(null); }} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleGuardar} disabled={saving}>
                Guardar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                Editar días
              </Button>
              <Button size="sm" variant="ghost" onClick={handleEliminar} disabled={saving}>
                Quitar
              </Button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <DiasChipsSelector value={dias} onChange={setDias} deshabilitados={diasOcupadosPorOtros} />
      ) : (
        <span className="text-xs text-muted-foreground">{formatDias(assignment.dias)}</span>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function NewAssignmentForm({
  spotId,
  profiles,
  diasOcupados,
  onSaved,
}: {
  spotId: string;
  profiles: Profile[];
  diasOcupados: Set<number>;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState<string>("");
  const [dias, setDias] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diasDisponibles = DIAS_SEMANA.filter((d) => !diasOcupados.has(d.value));

  async function handleAgregar() {
    setError(null);
    if (!userId) {
      setError("Elegí un colaborador.");
      return;
    }
    if (dias.length === 0) {
      setError("Elegí al menos un día.");
      return;
    }
    setSaving(true);
    const res = await createFixedSpotAssignmentAction({ spotId, userId, dias });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo crear la asignación.");
      return;
    }
    setUserId("");
    setDias([]);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Agregar asignación
      </p>
      <Select value={userId || undefined} onValueChange={setUserId}>
        <SelectTrigger>
          <SelectValue placeholder="Elegí un colaborador" />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.nombre} ({p.email})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {diasDisponibles.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todos los días de la semana ya tienen un dueño asignado.
        </p>
      ) : (
        <DiasChipsSelector value={dias} onChange={setDias} deshabilitados={diasOcupados} />
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        size="sm"
        onClick={handleAgregar}
        disabled={saving || diasDisponibles.length === 0}
      >
        {saving ? "Guardando..." : "Agregar"}
      </Button>
    </div>
  );
}

function DiasChipsSelector({
  value,
  onChange,
  deshabilitados,
}: {
  value: number[];
  onChange: (dias: number[]) => void;
  deshabilitados: Set<number>;
}) {
  function toggle(dia: number) {
    if (deshabilitados.has(dia)) return;
    onChange(value.includes(dia) ? value.filter((d) => d !== dia) : [...value, dia].sort());
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {DIAS_SEMANA.map((d) => {
        const seleccionado = value.includes(d.value);
        const ocupado = deshabilitados.has(d.value);
        return (
          <button
            key={d.value}
            type="button"
            title={ocupado ? `${d.label} ya asignado a otro colaborador` : d.label}
            disabled={ocupado}
            onClick={() => toggle(d.value)}
            className={cn(
              "h-8 w-8 rounded-full border text-xs font-semibold transition-colors",
              seleccionado
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
              ocupado && !seleccionado && "cursor-not-allowed opacity-40"
            )}
          >
            {d.corta}
          </button>
        );
      })}
    </div>
  );
}
