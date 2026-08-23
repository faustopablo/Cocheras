"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  createBuildingAction,
  updateBuildingAction,
  createLevelAction,
  deleteLevelAction,
} from "@/app/actions/admin-buildings";
import type { Building, Level, ParkingSpot } from "@/lib/database.types";

export function BuildingsManager({
  buildings,
  levels,
  spots,
}: {
  buildings: Building[];
  levels: Level[];
  spots: ParkingSpot[];
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
          spotCount={spots.filter((s) => s.building_id === building.id).length}
        />
      ))}
    </div>
  );
}

function BuildingCard({
  building,
  levels,
  spotCount,
}: {
  building: Building;
  levels: Level[];
  spotCount: number;
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

  async function handleDeleteLevel(level: Level) {
    if (!confirm(`¿Eliminar el subsuelo "${level.nombre}"?`)) return;
    const res = await deleteLevelAction(level.id);
    if (res.ok) router.refresh();
    else alert(res.error);
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">Subsuelos</h4>
            <div className="flex flex-wrap items-center gap-2">
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
              <Button asChild size="sm" variant="secondary">
                <Link href={`/admin/cocheras?edificio=${building.id}`}>
                  Gestionar cocheras ({spotCount})
                </Link>
              </Button>
            </div>
          </div>

          {levels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este edificio todavía no tiene subsuelos.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {levels.map((level) => (
                <div
                  key={level.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <p className="font-medium">{level.nombre}</p>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteLevel(level)}>
                    Eliminar subsuelo
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
