"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Link "← Administración" para volver al hub desde cualquier subsección. */
export function AdminBreadcrumb() {
  const pathname = usePathname();
  if (pathname === "/admin") return null;

  return (
    <Link
      href="/admin"
      className="focus-ring inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Administración
    </Link>
  );
}
