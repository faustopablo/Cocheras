"use client";

import { Ban, CarFront } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpotDisplayInfo } from "@/lib/spot-status";
import type { ParkingSpot } from "@/lib/database.types";

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Tarjeta con forma de plaza de estacionamiento. La presentación deriva
 * pura y exclusivamente de `display` (calculado con
 * `computeSpotDisplayForDate`, ver lib/spot-status.ts); esta componente no
 * decide reglas de negocio.
 */
export function SpotCard({
  spot,
  display,
  onReservar,
}: {
  spot: ParkingSpot;
  display: SpotDisplayInfo;
  onReservar?: (spot: ParkingSpot) => void;
}) {
  const { estado, esMia, esReservaPropia, reservaActiva } = display;

  const fueraDeServicio = estado === "fuera_de_servicio";
  // "Ocupada"/"bloqueada" ajena: alguien más la tiene hoy (reserva puntual
  // activa, o es su día fijo y no la liberó). Si es mía, se pinta como propia.
  const ocupadaPorOtro = !esMia && (estado === "ocupada" || estado === "bloqueada");
  const reservadaPorOtro = ocupadaPorOtro && estado === "ocupada";
  const libre = estado === "libre" && !esMia;
  const puedeReservar = estado === "libre" && !esMia;

  function handleClick() {
    if (puedeReservar && onReservar) {
      onReservar(spot);
      return;
    }
    if (fueraDeServicio) return;
    if (reservadaPorOtro) {
      alert(
        `Cochera ${spot.codigo}: reservada por otro colaborador${
          reservaActiva ? ` hasta las ${formatHora(reservaActiva.fecha_fin)}.` : "."
        }`
      );
      return;
    }
    if (ocupadaPorOtro) {
      alert(
        `Cochera ${spot.codigo}: es una cochera fija asignada a otro colaborador este día y no fue liberada.`
      );
    }
  }

  const esClickeable = puedeReservar || reservadaPorOtro || ocupadaPorOtro;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!esClickeable}
      title={spot.tipo === "fija" ? `${spot.codigo} · cochera fija` : spot.codigo}
      className={cn(
        "focus-ring group relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-[1.5rem] border-2 p-2 text-center transition-transform",
        esClickeable && "cursor-pointer hover:scale-[1.03] active:scale-[0.98]",
        !esClickeable && "cursor-default",
        // Libre: blanco con borde verde Comafi.
        libre && "border-comafi-verde-claro bg-white",
        // Mía (reserva puntual propia, o mi día fijo no liberado).
        esMia && "border-comafi-verde-claro bg-comafi-verde-claro shadow-sm",
        // Reservada por otro: blanco con borde verde oscuro + badge.
        reservadaPorOtro && "border-comafi-verde-oscuro bg-white",
        // Ocupada / bloqueada por el dueño fijo, sin liberar: relleno oscuro.
        ocupadaPorOtro && !reservadaPorOtro && "border-comafi-verde-oscuro bg-comafi-verde-oscuro",
        // Fuera de servicio: gris neutro y atenuado.
        fueraDeServicio && "border-border bg-muted opacity-70"
      )}
    >
      {spot.tipo === "fija" && (
        <span
          className={cn(
            "absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            esMia || ocupadaPorOtro ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          Fija
        </span>
      )}

      {reservadaPorOtro && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-comafi-verde-oscuro px-1.5 py-0.5 text-[9px] font-bold text-white">
          RES
        </span>
      )}

      {fueraDeServicio ? (
        <Ban className="h-4 w-4 text-muted-foreground" aria-hidden />
      ) : (
        <CarFront
          className={cn(
            "h-4 w-4",
            libre && "text-comafi-verde-claro",
            esMia && "text-white",
            (reservadaPorOtro || (ocupadaPorOtro && !reservadaPorOtro)) &&
              (reservadaPorOtro ? "text-comafi-verde-oscuro" : "text-white")
          )}
          aria-hidden
        />
      )}

      <span
        className={cn(
          "text-lg font-extrabold leading-tight sm:text-xl",
          libre && "text-comafi-verde-claro",
          esMia && "text-white",
          reservadaPorOtro && "text-comafi-verde-oscuro",
          ocupadaPorOtro && !reservadaPorOtro && "text-white",
          fueraDeServicio && "text-muted-foreground line-through"
        )}
      >
        {spot.codigo}
      </span>

      {esReservaPropia && reservaActiva && (
        <span className="text-[10px] font-semibold text-white/90">
          hasta {formatHora(reservaActiva.fecha_fin)}
        </span>
      )}
      {esMia && !esReservaPropia && (
        <span className="text-[10px] font-semibold text-white/90">Tu día</span>
      )}
    </button>
  );
}
