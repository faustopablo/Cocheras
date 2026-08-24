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

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Fecha "de hoy" (yyyy-MM-dd) en hora argentina, independiente del
 * timezone del servidor o del navegador. Usar SIEMPRE que se calcule
 * "hoy" para validar o limitar fechas de reserva/liberación: en el
 * servidor `new Date().toISOString()` es UTC (= ART+3), así que desde
 * las 21:00 hora argentina la fecha UTC ya es "mañana" y las reservas
 * para hoy se rechazaban como pasadas.
 */
export function hoyArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Date local (00:00) a partir de "yyyy-MM-dd", sin pasar por UTC. */
export function dateFromDateValue(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** "Hoy" en hora argentina como Date local (00:00). */
export function hoyArgentinaDate(): Date {
  return dateFromDateValue(hoyArgentina());
}

/** Formato yyyy-MM-dd (hora local) para inputs `type="date"`. */
export function toLocalDateValue(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** true si `a` y `b` caen en el mismo día calendario (hora local). */
export function isSameLocalDate(a: Date, b: Date) {
  return toLocalDateValue(a) === toLocalDateValue(b);
}

/** Devuelve una nueva fecha desplazada `dias` días (hora local, a las 00:00). */
export function addDays(date: Date, dias: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + dias);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Lunes (00:00 local) de la semana ISO a la que pertenece `date`. */
export function startOfIsoWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return addDays(d, -(isoWeekday(d) - 1));
}

/** "23/08/2026" a partir de un `Date` (sin pasar por ISO string). */
export function formatDateShort(date: Date) {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
