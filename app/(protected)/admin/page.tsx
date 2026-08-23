import Link from "next/link";
import {
  Building2,
  Car,
  Users,
  CalendarCheck,
  SlidersHorizontal,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Administración — Cocheras Comafi" };

interface AdminCard {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const ADMIN_CARDS: AdminCard[] = [
  {
    href: "/admin/edificios",
    title: "Edificios",
    description: "ABM de edificios y subsuelos.",
    icon: Building2,
  },
  {
    href: "/admin/cocheras",
    title: "Cocheras",
    description: "Alta, edición y baja de cocheras por edificio y subsuelo.",
    icon: Car,
  },
  {
    href: "/admin/usuarios",
    title: "Usuarios",
    description: "Alta de colaboradores, roles y jerarquías.",
    icon: Users,
  },
  {
    href: "/admin/reservas",
    title: "Reservas",
    description: "Listado y gestión de todas las reservas de la organización.",
    icon: CalendarCheck,
  },
  {
    href: "/admin/reglas",
    title: "Reglas",
    description: "Límites de anticipación, duración y tolerancia de no-show.",
    icon: SlidersHorizontal,
  },
  {
    href: "/admin/estadisticas",
    title: "Estadísticas",
    description: "KPIs de ocupación y uso de cocheras.",
    icon: BarChart3,
  },
];

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Elegí una sección para gestionar edificios, cocheras, usuarios, reservas, reglas o ver
          estadísticas de uso.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_CARDS.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="focus-ring block rounded-lg">
            <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/40">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
