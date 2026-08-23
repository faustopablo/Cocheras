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
} from "@/app/actions/admin-buildings";
import type { Building, EstadoCochera, Level, ParkingSpot, Profile, TipoCochera } from "@/lib/database.types";

const ESTADOS: EstadoCochera[] = ["libre", "ocupada", "bloqueada", "fuera_de_servicio"];
const ALL = "all";

export function SpotsManager({
  buildings,
  levels,
  spots,
  profiles,
}: {
  buildings: Building[];
  levels: Level[];
  spots: ParkingSpot[];
  profiles: Profile[];
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
              <SpotFormDialog building={selectedBuilding} level={selectedLevel} profiles={profiles} />
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
                  <TableHead>Asignada a</TableHead>
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
}: {
  spot: ParkingSpot;
  building: Building;
  level: Level;
  profiles: Profile[];
}) {
  const router = useRouter();
  const asignado = profiles.find((p) => p.id === spot.assigned_user_id);

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
      <TableCell>{asignado?.nombre ?? "-"}</TableCell>
      <TableCell>
        <Badge variant="outline">{spot.estado}</Badge>
      </TableCell>
      <TableCell className="flex gap-2">
        <SpotFormDialog building={building} level={level} profiles={profiles} spot={spot} />
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
  profiles,
  spot,
}: {
  building: Building;
  level: Level;
  profiles: Profile[];
  spot?: ParkingSpot;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState(spot?.codigo ?? "");
  const [tipo, setTipo] = useState<TipoCochera>(spot?.tipo ?? "libre");
  const [esPrereservada, setEsPrereservada] = useState(spot?.es_prereservada ?? false);
  const [assignedUserId, setAssignedUserId] = useState<string>(spot?.assigned_user_id ?? "none");
  const [estado, setEstado] = useState<EstadoCochera>(spot?.estado ?? "libre");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const result = spot
      ? await updateSpotAction({
          id: spot.id,
          codigo,
          tipo,
          esPrereservada,
          assignedUserId: assignedUserId === "none" ? null : assignedUserId,
          estado,
        })
      : await createSpotAction({
          buildingId: building.id,
          levelId: level.id,
          codigo,
          tipo,
          esPrereservada,
          assignedUserId: assignedUserId === "none" ? null : assignedUserId,
        });

    setSaving(false);
    if (result.ok) {
      setOpen(false);
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
          {tipo === "fija" && (
            <div>
              <Label>Asignada a</Label>
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} ({p.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                  La disponibilidad para que otros la reserven se gestiona con liberaciones por
                  rango de fechas (el titular las crea desde &quot;Mi cochera fija&quot;).
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
      </DialogContent>
    </Dialog>
  );
}
