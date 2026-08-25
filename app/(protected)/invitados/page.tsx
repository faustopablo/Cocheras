import { createClient } from "@/lib/supabase/server";
import { requireAdminOrAsistente } from "@/lib/auth";
import { GuestForm } from "@/components/guest-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, hoyArgentina } from "@/lib/utils";
import type { ParkingSpot, ReservationWithRelations } from "@/lib/database.types";

export const metadata = { title: "Invitados — Cocheras Comafi" };

export default async function InvitadosPage() {
  await requireAdminOrAsistente();
  const supabase = await createClient();

  const { data: spots } = await supabase
    .from("parking_spots")
    .select("*")
    .eq("estado", "libre")
    .order("codigo");

  // Server component: "hoy" debe calcularse en hora argentina, no en la del servidor.
  const hoyFecha = hoyArgentina();

  const { data: guestReservations } = await supabase
    .from("reservations")
    .select("*, guest:guests(*), spot:parking_spots(*, building:buildings(*))")
    .eq("origen", "invitado")
    .eq("fecha", hoyFecha)
    .order("created_at", { ascending: true });

  const hoy = (guestReservations ?? []) as ReservationWithRelations[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Invitados</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Registrá una cochera para un visitante externo. No se solicita DNI: solo nombre,
          empresa y patente.
        </p>
      </div>

      <GuestForm availableSpots={(spots ?? []) as ParkingSpot[]} />

      <Card>
        <CardHeader>
          <CardTitle>Invitados de hoy</CardTitle>
        </CardHeader>
        <CardContent>
          {hoy.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay invitados registrados para hoy. Registrá al visitante con el
              formulario de arriba y va a aparecer en esta lista.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Patente</TableHead>
                  <TableHead>Cochera</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hoy.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.guest?.nombre}</TableCell>
                    <TableCell>{r.guest?.empresa || "-"}</TableCell>
                    <TableCell>{r.guest?.patente}</TableCell>
                    <TableCell>
                      {r.spot?.codigo} ({r.spot?.building?.nombre})
                    </TableCell>
                    <TableCell>{formatDate(r.fecha)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
