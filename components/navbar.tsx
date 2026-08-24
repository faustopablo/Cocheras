"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogOut, ShieldCheck } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/database.types";

const NAV_LINKS = [
  { href: "/", label: "Cocheras" },
  { href: "/reservas", label: "Mis reservas" },
  { href: "/invitados", label: "Invitados" },
];

export function Navbar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = profile.rol === "admin";
  const isAdminSection = pathname.startsWith("/admin");

  const linkClass = (href: string, mobile = false) =>
    cn(
      "focus-ring rounded-md px-3 text-sm font-medium transition-colors",
      mobile ? "py-3" : "py-2",
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
                <Link
                  href="/admin"
                  className={cn(
                    "focus-ring flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isAdminSection
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Administración
                </Link>
              </div>
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/perfil"
            className="focus-ring rounded-md px-2 py-1 text-right transition-colors hover:bg-white/10"
          >
            <p className="text-sm font-medium leading-tight">{profile.nombre}</p>
            <p className="flex items-center justify-end gap-1 text-xs text-white/60">
              {isAdmin && <ShieldCheck className="h-3 w-3" />}
              {isAdmin ? "Administrador" : "Colaborador"}
            </p>
          </Link>
          <form action={signOutAction}>
            <Button variant="ghost" size="icon" type="submit" title="Cerrar sesión" className="text-white hover:bg-white/10">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <button
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={linkClass(l.href, true)}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <div className="mt-1 border-t border-white/10 pt-1">
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className={cn(
                    "focus-ring flex items-center gap-2 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                    isAdminSection
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Administración
                </Link>
              </div>
            )}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <Link
              href="/perfil"
              onClick={() => setOpen(false)}
              className="focus-ring rounded-md px-1 py-1 transition-colors hover:bg-white/10"
            >
              <p className="text-sm font-medium">{profile.nombre}</p>
              <p className="text-xs text-white/60">{isAdmin ? "Administrador" : "Colaborador"}</p>
            </Link>
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
