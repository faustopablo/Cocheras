"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Se suscribe a cambios en tiempo real (Supabase Realtime) de las tablas
 * indicadas y refresca los datos del Server Component actual cuando
 * detecta un cambio. No renderiza nada visible.
 *
 * Importante sobre `reservations`: Supabase Realtime aplica la RLS de la
 * tabla igual que una consulta normal, así que un usuario común solo
 * recibiría eventos de SUS PROPIAS filas de `reservations` (ver policy
 * "reservations_select_propia_o_admin", 0001) — no se entera cuando OTRO
 * colaborador reserva o cancela. Por eso no conviene listar
 * `reservations` acá: en vez de eso, pasá un `pollMs` para refrescar
 * periódicamente (suficiente para este caso de uso; es la alternativa
 * más simple a suscribirse a la vista `active_reservations_board` de la
 * migración 0010, que Realtime no soporta porque solo escucha cambios de
 * tablas base, no de vistas).
 */
export function RealtimeRefresher({
  tables,
  pollMs,
}: {
  tables: string[];
  /** Si se indica, además refresca cada `pollMs` milisegundos sin
   * esperar un evento de Realtime (ver nota sobre `reservations` arriba). */
  pollMs?: number;
}) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`realtime-${tables.join("-")}`);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => router.refresh(), 300);
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);

  useEffect(() => {
    if (!pollMs) return;
    const interval = setInterval(() => router.refresh(), pollMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  return null;
}
