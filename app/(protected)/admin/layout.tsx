import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Defensa en profundidad: el middleware ya bloquea /admin/* para no-admins,
  // pero volvemos a chequear el rol server-side antes de renderizar nada.
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md bg-accent px-4 py-2 text-sm text-accent-foreground">
        Panel de administración — los cambios acá afectan a toda la organización.
      </div>
      {children}
    </div>
  );
}
