import { createClient } from "@/lib/supabase/server";
import { UsersManager } from "@/components/admin/users-manager";
import type { Profile } from "@/lib/database.types";

export const metadata = { title: "Usuarios — Admin Cocheras Comafi" };

export default async function AdminUsuariosPage() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: userData }] = await Promise.all([
    supabase.from("profiles").select("*").order("nombre"),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Alta manual de colaboradores y edición de rol, jerarquía y estado. No hay auto-registro.
        </p>
      </div>
      <UsersManager
        profiles={(profiles ?? []) as Profile[]}
        currentUserId={userData.user?.id ?? ""}
      />
    </div>
  );
}
