import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { GuestForm } from "@/components/guest-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import type { ParkingSpot, ReservationWithRelations } from "@/lib/database.types";

export const metadata = { title: "Invitados — Cocheras Comafi" };

export default async function InvitadosPage() {
  await requireUser();
  const supabase = await createClient();

  const { data: spots } = await supabase
    .from("parking_spots")
    .select("*")
    .eq("estado", "libre")
    .order("codigo");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { data: guestReservations } = await supabase
    .from("reservations")
    .select("*, guest:guests(*), spot:parking_spots(*, building:buildings(*))")
    .eq("origen", "invitado")
    .gte("fecha_inicio", startOfDay.toISOString())
    .lte("fecha_inicio", endOfDay.toISOString())
    .order("fecha_inicio", { ascending: true });

  const hoy = (guestReservations ?? []) as ReservationWithRelations[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Invitados</h1>
        <p className="text-sm text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">No hay invitados registrados para hoy.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Patente</TableHead>
                  <TableHead>Cochera</TableHead>
                  <TableHead>Horario</TableHead>
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
                    <TableCell>
                      {formatDateTime(r.fecha_inicio)} — {formatDateTime(r.fecha_fin)}
                    </TableCell>
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
