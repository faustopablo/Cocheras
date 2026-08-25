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

  // Defensa en profundidad: el proxy (lib/supabase/middleware.ts) ya corta
  // el acceso de usuarios inactivos en todas las rutas autenticadas, pero
  // este chequeo cubre cualquier caso en que se invoque `requireUser` sin
  // pasar por el proxy.
  if (!(profile as Profile).activo) {
    await supabase.auth.signOut();
    redirect("/login?error=inactivo");
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

/**
 * Igual que requireUser pero además exige rol admin o asistente (los
 * únicos con acceso a /invitados). Redirige a "/" si no lo es.
 */
export async function requireAdminOrAsistente() {
  const { user, profile } = await requireUser();

  if ((profile.rol !== "admin" && profile.rol !== "asistente") || !profile.activo) {
    redirect("/");
  }

  return { user, profile };
}
