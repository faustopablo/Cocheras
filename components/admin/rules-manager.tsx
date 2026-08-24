"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertRuleAction } from "@/app/actions/admin-rules";
import type { Building, ParkingRule } from "@/lib/database.types";

function RuleForm({
  title,
  description,
  buildingId,
  rule,
}: {
  title: string;
  description: string;
  buildingId: string | null;
  rule: ParkingRule | null;
}) {
  const router = useRouter();
  const [dias, setDias] = useState(rule?.dias_max_reserva_futura ?? 14);
  const [maxSimultaneas, setMaxSimultaneas] = useState(rule?.max_reservas_simultaneas_por_usuario ?? 1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await upsertRuleAction({
      buildingId,
      diasMaxReservaFutura: dias,
      maxReservasSimultaneasPorUsuario: maxSimultaneas,
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo guardar la regla. Volvé a intentarlo.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`dias-${buildingId ?? "global"}`}>Días máximos de reserva a futuro</Label>
            <Input
              id={`dias-${buildingId ?? "global"}`}
              type="number"
              min={0}
              value={dias}
              onChange={(e) => {
                setDias(Number(e.target.value));
                setSaved(false);
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`max-${buildingId ?? "global"}`}>Máx. reservas simultáneas por usuario</Label>
            <Input
              id={`max-${buildingId ?? "global"}`}
              type="number"
              min={1}
              value={maxSimultaneas}
              onChange={(e) => {
                setMaxSimultaneas(Number(e.target.value));
                setSaved(false);
              }}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar regla"}
            </Button>
            {saved && (
              <span role="status" className="text-sm font-medium text-success">
                Regla guardada
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function RulesManager({
  buildings,
  globalRule,
  rulesByBuilding,
}: {
  buildings: Building[];
  globalRule: ParkingRule | null;
  rulesByBuilding: Record<string, ParkingRule>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <RuleForm
        title="Regla global"
        description="Se aplica a todos los edificios que no tengan una regla propia."
        buildingId={null}
        rule={globalRule}
      />
      {buildings.map((b) => (
        <RuleForm
          key={b.id}
          title={`Regla — ${b.nombre}`}
          description="Si se guarda, sobreescribe la regla global para este edificio."
          buildingId={b.id}
          rule={rulesByBuilding[b.id] ?? null}
        />
      ))}
    </div>
  );
}
