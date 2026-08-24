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
  const [error, setError] = useState<string | null>(null);

  async function handleCreateBuilding(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await createBuildingAction({ nombre, direccion });
    setLoading(false);
    if (res.ok) {
      setNombre("");
      setDireccion("");
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo crear el edificio. Volvé a intentarlo.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Nuevo edificio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateBuilding} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="b-nombre">Nombre</Label>
                <Input id="b-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="b-direccion">Dirección</Label>
                <Input id="b-direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Creando..." : "Crear edificio"}
              </Button>
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {buildings.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">Todavía no hay edificios</p>
          <p className="text-sm text-muted-foreground">
            Creá el primero con el formulario de arriba; después vas a poder agregarle subsuelos y
            cocheras.
          </p>
        </div>
      )}

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
  const [addingLevel, setAddingLevel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await updateBuildingAction({ id: building.id, nombre, direccion, activo });
    setSaving(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "No se pudieron guardar los cambios. Volvé a intentarlo.");
  }

  async function handleAddLevel(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNivel.trim()) return;
    setAddingLevel(true);
    setError(null);
    const res = await createLevelAction({ buildingId: building.id, nombre: nuevoNivel });
    setAddingLevel(false);
    if (res.ok) {
      setNuevoNivel("");
      router.refresh();
    } else setError(res.error ?? "No se pudo agregar el subsuelo. Volvé a intentarlo.");
  }

  async function handleDeleteLevel(level: Level) {
    if (!confirm(`¿Eliminar el subsuelo "${level.nombre}"?`)) return;
    setError(null);
    const res = await deleteLevelAction(level.id);
    if (res.ok) router.refresh();
    else setError(res.error ?? "No se pudo eliminar el subsuelo. Volvé a intentarlo.");
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
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`nombre-${building.id}`}>Nombre</Label>
            <Input id={`nombre-${building.id}`} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`direccion-${building.id}`}>Dirección</Label>
            <Input id={`direccion-${building.id}`} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
          <div className="flex h-10 items-center gap-2">
            <Label htmlFor={`activo-${building.id}`}>Activo</Label>
            <Switch id={`activo-${building.id}`} checked={activo} onCheckedChange={setActivo} />
          </div>
          <Button onClick={handleSave} disabled={saving} variant="secondary">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

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
                <Button type="submit" size="sm" variant="outline" disabled={addingLevel}>
                  {addingLevel ? "Agregando..." : "Agregar subsuelo"}
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
