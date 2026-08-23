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
  const [horaLimite, setHoraLimite] = useState(rule?.hora_limite_checkin?.slice(0, 5) ?? "11:00");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await upsertRuleAction({
      buildingId,
      diasMaxReservaFutura: dias,
      maxReservasSimultaneasPorUsuario: maxSimultaneas,
      horaLimiteCheckin: horaLimite,
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
            <Label>Máx. reservas simultáneas por usuario</Label>
            <Input
              type="number"
              min={1}
              value={maxSimultaneas}
              onChange={(e) => setMaxSimultaneas(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Hora límite de check-in</Label>
            <Input
              type="time"
              value={horaLimite}
              onChange={(e) => setHoraLimite(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Si a esa hora del día reservado no hubo check-in, la reserva se libera automáticamente.
            </p>
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
