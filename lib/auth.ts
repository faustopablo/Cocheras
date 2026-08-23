import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/database.types";

/**
 * Obtiene el usuario autenticado y su profile. Si no hay sesión, redirige a /login.
 * Pensado para usarse en Server Components / layouts (defensa en profundidad,
 * además del middleware que ya protege las rutas).
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return { user: userData.user, profile: profile as Profile };
}

/** Igual que requireUser pero además exige rol admin. Redirige a "/" si no lo es. */
export async function requireAdmin() {
  const { user, profile } = await requireUser();

  if (profile.rol !== "admin" || !profile.activo) {
    redirect("/");
  }

  return { user, profile };
}
