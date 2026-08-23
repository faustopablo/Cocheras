import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DiaSemanaIso } from "@/lib/database.types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 1=lunes ... 7=domingo (ISO), como devuelve extract(isodow from ...) en Postgres. */
export const DIAS_SEMANA: { value: DiaSemanaIso; label: string; corta: string }[] = [
  { value: 1, label: "Lunes", corta: "L" },
  { value: 2, label: "Martes", corta: "M" },
  { value: 3, label: "Miércoles", corta: "X" },
  { value: 4, label: "Jueves", corta: "J" },
  { value: 5, label: "Viernes", corta: "V" },
  { value: 6, label: "Sábado", corta: "S" },
  { value: 7, label: "Domingo", corta: "D" },
];

const DIA_LABEL: Record<number, string> = Object.fromEntries(
  DIAS_SEMANA.map((d) => [d.value, d.label])
);

/** Día de la semana ISO (1=lunes..7=domingo) de una fecha, en horario local. */
export function isoWeekday(date: Date): DiaSemanaIso {
  const js = date.getDay(); // 0=domingo..6=sabado
  return (js === 0 ? 7 : js) as DiaSemanaIso;
}

/** "Lunes y miércoles", "Lunes, martes y viernes", etc. */
export function formatDias(dias: number[]): string {
  const ordenados = [...dias].sort((a, b) => a - b).map((d) => DIA_LABEL[d] ?? "?");
  if (ordenados.length === 0) return "Sin días asignados";
  if (ordenados.length === 1) return ordenados[0];
  return `${ordenados.slice(0, -1).join(", ")} y ${ordenados[ordenados.length - 1]}`;
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function toLocalInputValue(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Formato yyyy-MM-dd (hora local) para inputs `type="date"`. */
export function toLocalDateValue(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
