"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut, ShieldCheck, ChevronDown } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/database.types";

const NAV_LINKS = [
  { href: "/", label: "Cocheras" },
  { href: "/reservas", label: "Mis reservas" },
  { href: "/invitados", label: "Invitados" },
];

const ADMIN_LINKS = [
  { href: "/admin/edificios", label: "Edificios" },
  { href: "/admin/cocheras", label: "Cocheras" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/reservas", label: "Reservas" },
  { href: "/admin/reglas", label: "Reglas" },
  { href: "/admin/estadisticas", label: "Estadísticas" },
];

export function Navbar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [adminOpenMobile, setAdminOpenMobile] = useState(false);
  const isAdmin = profile.rol === "admin";
  const isAdminSection = pathname.startsWith("/admin");

  const linkClass = (href: string) =>
    cn(
      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
      pathname === href
        ? "bg-white/15 text-white"
        : "text-white/80 hover:bg-white/10 hover:text-white"
    );

  return (
    <header className="sticky top-0 z-40 bg-comafi-negro-verdoso text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm">
              C
            </span>
            <span className="hidden sm:inline">Cocheras Comafi</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <div className="ml-2 flex items-center gap-1 border-l border-white/20 pl-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-ring",
                        isAdminSection
                          ? "bg-white/15 text-white"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Administración
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {ADMIN_LINKS.map((l) => (
                      <DropdownMenuItem key={l.href} asChild>
                        <Link
                          href={l.href}
                          className={cn(
                            "w-full cursor-pointer",
                            pathname === l.href && "bg-accent text-accent-foreground"
                          )}
                        >
                          {l.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{profile.nombre}</p>
            <p className="flex items-center justify-end gap-1 text-xs text-white/60">
              {isAdmin && <ShieldCheck className="h-3 w-3" />}
              {isAdmin ? "Administrador" : "Colaborador"}
            </p>
          </div>
          <form action={signOutAction}>
            <Button variant="ghost" size="icon" type="submit" title="Cerrar sesión" className="text-white hover:bg-white/10">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <button
          className="focus-ring rounded-md p-2 text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <div className="mt-1 border-t border-white/10 pt-1">
                <button
                  type="button"
                  aria-expanded={adminOpenMobile}
                  onClick={() => setAdminOpenMobile((v) => !v)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isAdminSection
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Administración
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", adminOpenMobile && "rotate-180")} />
                </button>
                {adminOpenMobile && (
                  <div className="mt-1 flex flex-col gap-1 pl-4">
                    {ADMIN_LINKS.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={linkClass(l.href)}
                        onClick={() => {
                          setOpen(false);
                          setAdminOpenMobile(false);
                        }}
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <div>
              <p className="text-sm font-medium">{profile.nombre}</p>
              <p className="text-xs text-white/60">{isAdmin ? "Administrador" : "Colaborador"}</p>
            </div>
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit" className="text-white hover:bg-white/10">
                <LogOut className="mr-1 h-4 w-4" /> Salir
              </Button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
