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
  const [horas, setHoras] = useState(rule?.horas_max_por_reserva ?? 12);
  const [maxSimultaneas, setMaxSimultaneas] = useState(rule?.max_reservas_simultaneas_por_usuario ?? 1);
  const [tolerancia, setTolerancia] = useState(rule?.minutos_tolerancia_no_show ?? 30);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await upsertRuleAction({
      buildingId,
      diasMaxReservaFutura: dias,
      horasMaxPorReserva: horas,
      maxReservasSimultaneasPorUsuario: maxSimultaneas,
      minutosToleranciaNoShow: tolerancia,
    });
    setSaving(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Días máximos de reserva a futuro</Label>
            <Input type="number" min={0} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
          </div>
          <div>
            <Label>Horas máximas por reserva</Label>
            <Input type="number" min={1} value={horas} onChange={(e) => setHoras(Number(e.target.value))} />
          </div>
          <div>
            <Label>Máx. reservas simultáneas por usuario</Label>
            <Input
              type="number"
              min={1}
              value={maxSimultaneas}
              onChange={(e) => setMaxSimultaneas(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Minutos de tolerancia para no-show</Label>
            <Input
              type="number"
              min={0}
              value={tolerancia}
              onChange={(e) => setTolerancia(Number(e.target.value))}
            />
          </div>
          <Button type="submit" disabled={saving} className="sm:col-span-2 self-start">
            {saving ? "Guardando..." : "Guardar regla"}
          </Button>
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
