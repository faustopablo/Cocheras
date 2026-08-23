"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface AuthActionResult {
  error?: string;
}

const DOMINIO_PERMITIDO = "@comafi.com.ar";

export async function signInAction(
  _prev: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const redirectTo = String(formData.get("redirectTo") || "/");

  if (!email || !password) {
    return { error: "Ingresá tu email y tu contraseña." };
  }

  if (!email.endsWith(DOMINIO_PERMITIDO)) {
    return {
      error: `Solo se permite el ingreso con emails corporativos (${DOMINIO_PERMITIDO}).`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email o contraseña incorrectos. Verificá tus datos e intentá de nuevo." };
  }

  redirect(redirectTo || "/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
