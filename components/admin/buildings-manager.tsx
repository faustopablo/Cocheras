"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  createBuildingAction,
  updateBuildingAction,
  createLevelAction,
  deleteLevelAction,
  createSpotAction,
  updateSpotAction,
  deleteSpotAction,
} from "@/app/actions/admin-buildings";
import type { Building, EstadoCochera, Level, ParkingSpot, Profile, TipoCochera } from "@/lib/database.types";

const ESTADOS: EstadoCochera[] = ["libre", "ocupada", "bloqueada", "fuera_de_servicio"];

export function BuildingsManager({
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
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateBuilding(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await createBuildingAction({ nombre, direccion });
    setLoading(false);
    if (res.ok) {
      setNombre("");
      setDireccion("");
      router.refresh();
    } else alert(res.error);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo edificio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateBuilding} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="b-nombre">Nombre</Label>
              <Input id="b-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="flex-1">
              <Label htmlFor="b-direccion">Dirección</Label>
              <Input id="b-direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading}>
              Crear edificio
            </Button>
          </form>
        </CardContent>
      </Card>

      {buildings.map((building) => (
        <BuildingCard
          key={building.id}
          building={building}
          levels={levels.filter((l) => l.building_id === building.id)}
          spots={spots.filter((s) => s.building_id === building.id)}
          profiles={profiles}
        />
      ))}
    </div>
  );
}

function BuildingCard({
  building,
  levels,
  spots,
  profiles,
}: {
  building: Building;
  levels: Level[];
  spots: ParkingSpot[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(building.nombre);
  const [direccion, setDireccion] = useState(building.direccion ?? "");
  const [activo, setActivo] = useState(building.activo);
  const [nuevoNivel, setNuevoNivel] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await updateBuildingAction({ id: building.id, nombre, direccion, activo });
    setSaving(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  async function handleAddLevel(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNivel.trim()) return;
    const res = await createLevelAction({ buildingId: building.id, nombre: nuevoNivel });
    if (res.ok) {
      setNuevoNivel("");
      router.refresh();
    } else alert(res.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {building.nombre}
          {!building.activo && <Badge variant="muted">Inactivo</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label>Dirección</Label>
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`activo-${building.id}`}>Activo</Label>
            <Switch id={`activo-${building.id}`} checked={activo} onCheckedChange={setActivo} />
          </div>
          <Button onClick={handleSave} disabled={saving} variant="secondary">
            Guardar
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Subsuelos y cocheras</h4>
            <form onSubmit={handleAddLevel} className="flex gap-2">
              <Input
                placeholder="Nombre del subsuelo"
                value={nuevoNivel}
                onChange={(e) => setNuevoNivel(e.target.value)}
                className="h-9 w-48"
              />
              <Button type="submit" size="sm" variant="outline">
                Agregar subsuelo
              </Button>
            </form>
          </div>

          {levels.map((level) => (
            <LevelBlock
              key={level.id}
              level={level}
              building={building}
              spots={spots.filter((s) => s.level_id === level.id)}
              profiles={profiles}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LevelBlock({
  level,
  building,
  spots,
  profiles,
}: {
  level: Level;
  building: Building;
  spots: ParkingSpot[];
  profiles: Profile[];
}) {
  const router = useRouter();

  async function handleDeleteLevel() {
    if (!confirm(`¿Eliminar el subsuelo "${level.nombre}"?`)) return;
    const res = await deleteLevelAction(level.id);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium">{level.nombre}</p>
        <div className="flex gap-2">
          <SpotFormDialog building={building} level={level} profiles={profiles} />
          <Button size="sm" variant="ghost" onClick={handleDeleteLevel}>
            Eliminar subsuelo
          </Button>
        </div>
      </div>

      {spots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin cocheras en este subsuelo.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prereservada</TableHead>
              <TableHead>Asignada a</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {spots.map((spot) => (
              <SpotRow key={spot.id} spot={spot} building={building} level={level} profiles={profiles} />
            ))}
          </TableBody>
        </Table>
      )}
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
          <DialogTitle>{spot ? `Editar ${spot.codigo}` : `Nueva cochera en ${level.nombre}`}</DialogTitle>
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
