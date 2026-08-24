"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  FijasLiberadasVsBloqueadas,
  OcupacionPorDiaSemana,
  OcupacionPorEdificio,
  OcupacionPorSubsuelo,
  RankingCochera,
  RotacionPorJerarquia,
  RotacionPorUsuario,
} from "@/lib/stats";

// Paleta categórica validada (ver dataviz skill / referencia palette.md).
// Se usa el prefijo consecutivo de la paleta documentada para garantizar
// separación CVD-safe entre series adyacentes.
const PALETTE = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a", // el más cercano al verde Comafi dentro de la paleta validada
  yellow: "#eda100",
  red: "#e34948",
};

const JERARQUIA_LABEL: Record<string, string> = {
  colaborador: "Colaborador",
  gerente: "Gerente",
  directivo: "Directivo",
};

function ChartCard({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  table?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="h-64 w-full">{children}</div>
        {table && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Ver como tabla
            </summary>
            <div className="mt-2">{table}</div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export function OcupacionPorEdificioChart({ data }: { data: OcupacionPorEdificio[] }) {
  return (
    <ChartCard
      title="Ocupación por edificio"
      description="% de cocheras con reserva activa o completada sobre el total."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Edificio</TableHead>
              <TableHead>Ocupación</TableHead>
              <TableHead>Cocheras</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.edificio}>
                <TableCell>{d.edificio}</TableCell>
                <TableCell>{d.ocupacion}%</TableCell>
                <TableCell>{d.totalCocheras}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="edificio" tick={{ fontSize: 12 }} />
          <YAxis unit="%" tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}%`, "Ocupación"]} />
          <Bar dataKey="ocupacion" fill={PALETTE.blue} radius={[4, 4, 0, 0]} name="Ocupación" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function OcupacionPorSubsueloChart({ data }: { data: OcupacionPorSubsuelo[] }) {
  return (
    <ChartCard
      title="Ocupación por subsuelo"
      description="Detalle de ocupación dentro de cada edificio."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subsuelo</TableHead>
              <TableHead>Edificio</TableHead>
              <TableHead>Ocupación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.etiqueta}>
                <TableCell>{d.etiqueta}</TableCell>
                <TableCell>{d.edificio}</TableCell>
                <TableCell>{d.ocupacion}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
          <YAxis unit="%" tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}%`, "Ocupación"]} />
          <Bar dataKey="ocupacion" fill={PALETTE.orange} radius={[4, 4, 0, 0]} name="Ocupación" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function OcupacionPorDiaSemanaChart({ data }: { data: OcupacionPorDiaSemana[] }) {
  return (
    <ChartCard
      title="Ocupación por día de la semana"
      description="Distribución de reservas según el día de la semana reservado."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Día</TableHead>
              <TableHead>% de reservas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.dia}>
                <TableCell>{d.dia}</TableCell>
                <TableCell>{d.ocupacion}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
          <YAxis unit="%" tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}%`, "% de reservas"]} />
          <Bar dataKey="ocupacion" fill={PALETTE.aqua} radius={[4, 4, 0, 0]} name="% de reservas" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function RotacionPorJerarquiaChart({ data }: { data: RotacionPorJerarquia[] }) {
  const colors = [PALETTE.blue, PALETTE.orange, PALETTE.aqua];
  return (
    <ChartCard
      title="Rotación por jerarquía"
      description="Cantidad de reservas activas o completadas por jerarquía."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jerarquía</TableHead>
              <TableHead>Reservas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.jerarquia}>
                <TableCell>{JERARQUIA_LABEL[d.jerarquia]}</TableCell>
                <TableCell>{d.reservas}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data.map((d) => ({ ...d, jerarquiaLabel: JERARQUIA_LABEL[d.jerarquia] }))}
          margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="jerarquiaLabel" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="reservas" radius={[4, 4, 0, 0]} name="Reservas">
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function RotacionPorUsuarioTable({ data }: { data: RotacionPorUsuario[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rotación por usuario</CardTitle>
        <CardDescription>Top colaboradores por cantidad de reservas.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay datos suficientes.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Jerarquía</TableHead>
                <TableHead>Reservas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.usuario}>
                  <TableCell>{d.usuario}</TableCell>
                  <TableCell>{JERARQUIA_LABEL[d.jerarquia]}</TableCell>
                  <TableCell>{d.reservas}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function RankingCocherasChart({
  masUsadas,
  menosUsadas,
}: {
  masUsadas: RankingCochera[];
  menosUsadas: RankingCochera[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title="Cocheras más usadas" description="Top 5 por cantidad de reservas.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={masUsadas} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="codigo" tick={{ fontSize: 12 }} width={70} />
            <Tooltip />
            <Bar dataKey="usos" fill={PALETTE.aqua} radius={[0, 4, 4, 0]} name="Usos" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Cocheras menos usadas" description="Bottom 5 por cantidad de reservas.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={menosUsadas} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="codigo" tick={{ fontSize: 12 }} width={70} />
            <Tooltip />
            <Bar dataKey="usos" fill={PALETTE.blue} radius={[0, 4, 4, 0]} name="Usos" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

export function CancelacionStat({ tasa }: { tasa: number }) {
  const nivel = tasa >= 20 ? "critical" : tasa >= 10 ? "warning" : "good";
  const color = nivel === "critical" ? PALETTE.red : nivel === "warning" ? PALETTE.yellow : PALETTE.aqua;
  const texto = nivel === "critical" ? "Alta" : nivel === "warning" ? "Moderada" : "Baja";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasa de cancelación</CardTitle>
        <CardDescription>% de reservas canceladas por el usuario sobre el total de reservas cerradas.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold" style={{ color }}>
            {tasa}%
          </span>
          <span className="text-sm font-medium text-muted-foreground">Nivel: {texto}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function FijasLiberadasChart({ data }: { data: FijasLiberadasVsBloqueadas }) {
  const chartData = [
    { name: "Liberadas", value: data.liberadas, color: PALETTE.blue },
    { name: "Bloqueadas (no liberadas)", value: data.bloqueadas, color: PALETTE.orange },
  ];

  return (
    <ChartCard
      title="Uso de cocheras fijas"
      description="Liberadas por su titular vs. bloqueadas (no disponibles para otros)."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estado</TableHead>
              <TableHead>Cantidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chartData.map((d) => (
              <TableRow key={d.name}>
                <TableCell>{d.name}</TableCell>
                <TableCell>{d.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={(entry) => `${entry.value}`}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Legend />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
