"use client";

import { Ban, CarFront } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpotDisplayInfo } from "@/lib/spot-status";
import type { ParkingSpot } from "@/lib/database.types";

/**
 * Tarjeta con forma de plaza de estacionamiento. La presentación deriva
 * pura y exclusivamente de `display` (calculado con
 * `computeSpotDisplayForDate`, ver lib/spot-status.ts); esta componente no
 * decide reglas de negocio.
 */
export function SpotCard({
  spot,
  display,
  ownerName,
  onReservar,
}: {
  spot: ParkingSpot;
  display: SpotDisplayInfo;
  /** Nombre de quien ocupa la cochera para el día visto: el dueño fijo
   * (asignada / libre por liberación) o quien tiene la reserva puntual
   * activa (ocupada) — "Invitado" si es una reserva de invitado. Lo ven
   * todos los usuarios, incluido el propio ocupante (ver
   * components/spots-board.tsx). */
  ownerName?: string;
  onReservar?: (spot: ParkingSpot) => void;
}) {
  const { estado, esMia, esReservaPropia, reservaActiva } = display;

  const fueraDeServicio = estado === "fuera_de_servicio";
  // "Ocupada": alguien tiene una reserva puntual activa sobre la cochera
  // ese día (la reserva confirmada equivale a check-in automático).
  // "Asignada": es una cochera fija con dueño
  // asignado el día visto, que no la liberó, y nadie tiene reserva activa.
  // Ambas son "de otro" cuando no soy yo (si es mía se pinta como propia).
  const reservadaPorOtro = !esMia && estado === "ocupada";
  const asignadaAOtro = !esMia && estado === "asignada";
  const ocupadaPorOtro = reservadaPorOtro || asignadaAOtro;
  const libre = estado === "libre" && !esMia;
  const puedeReservar = estado === "libre" && !esMia;
  // El dueño fijo liberó su día: la cochera queda "libre" para todos, pero
  // sigue teniendo dueño ese día de la semana (solo relevante para el admin,
  // que es a quien le llega `ownerName`).
  const liberadaPorDueno = libre && !!ownerName;

  // El estado de las no reservables ya se comunica en la propia tarjeta
  // (color + chip "Asignada"/"Ocupada"); el title amplía el detalle al hover.
  const title = fueraDeServicio
    ? `${spot.codigo} · fuera de servicio`
    : reservadaPorOtro
      ? `${spot.codigo} · reservada por otro colaborador este día`
      : asignadaAOtro
        ? `${spot.codigo} · cochera fija asignada a otro colaborador este día (no liberada)`
        : spot.tipo === "fija"
          ? `${spot.codigo} · cochera fija`
          : spot.codigo;

  return (
    <button
      type="button"
      onClick={() => {
        if (puedeReservar && onReservar) onReservar(spot);
      }}
      disabled={!puedeReservar}
      title={title}
      className={cn(
        "focus-ring group relative flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-[1.5rem] border-2 p-2 text-center transition-transform",
        puedeReservar && "cursor-pointer hover:scale-[1.03] active:scale-[0.98]",
        !puedeReservar && "cursor-default",
        // Libre: blanco con borde verde Comafi.
        libre && "border-comafi-verde-claro bg-white",
        // Mía (reserva puntual propia, o mi día fijo no liberado).
        esMia && "border-comafi-verde-claro bg-comafi-verde-claro shadow-sm",
        // Asignada a otro: cochera fija con dueño ese día, no liberada,
        // sin reserva activa. Relleno verde oscuro Comafi + badge.
        asignadaAOtro && "border-comafi-verde-oscuro bg-comafi-verde-oscuro",
        // Ocupada por otro: alguien tiene una reserva activa ahora mismo.
        // Relleno más oscuro (negro verdoso) para diferenciarla de "asignada".
        reservadaPorOtro && "border-comafi-negro-verdoso bg-comafi-negro-verdoso",
        // Fuera de servicio: gris neutro y atenuado.
        fueraDeServicio && "border-border bg-muted opacity-70"
      )}
    >
      {spot.tipo === "fija" && (
        <span
          className={cn(
            "absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            esMia || ocupadaPorOtro ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          Fija
        </span>
      )}

      {asignadaAOtro && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Asignada
        </span>
      )}
      {reservadaPorOtro && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Ocupada
        </span>
      )}

      {fueraDeServicio ? (
        <Ban className="h-4 w-4 text-muted-foreground" aria-hidden />
      ) : (
        <CarFront
          className={cn(
            "h-4 w-4",
            libre && "text-comafi-verde-claro",
            (esMia || ocupadaPorOtro) && "text-white"
          )}
          aria-hidden
        />
      )}

      <span
        className={cn(
          "text-lg font-extrabold leading-tight sm:text-xl",
          libre && "text-comafi-verde-claro",
          (esMia || ocupadaPorOtro) && "text-white",
          fueraDeServicio && "text-muted-foreground line-through"
        )}
      >
        {spot.codigo}
      </span>

      {esReservaPropia && reservaActiva && (
        <span className="text-[10px] font-semibold text-white">Tu reserva</span>
      )}
      {esMia && !esReservaPropia && (
        <span className="text-[10px] font-semibold text-white">Tu día</span>
      )}

      {ownerName && (
        <span
          title={liberadaPorDueno ? `${ownerName} (liberada)` : ownerName}
          className={cn(
            "block w-full max-w-full truncate px-1 text-[10px] font-semibold",
            (asignadaAOtro || reservadaPorOtro || esMia) && "text-white",
            liberadaPorDueno && "text-muted-foreground"
          )}
        >
          {ownerName}
          {liberadaPorDueno && " (liberada)"}
        </span>
      )}
    </button>
  );
}
