"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./reservations";
import type { Jerarquia, Rol } from "@/lib/database.types";

async function assertIsAdmin() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("No hay sesión activa.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", userData.user.id)
    .single();

  if (!profile || profile.rol !== "admin") {
    throw new Error("Solo un administrador puede realizar esta acción.");
  }
}

/**
 * Alta manual de usuario. Usa la Admin API de Supabase con la service
 * role key (nunca se expone al cliente: esta función solo corre en el
 * servidor). Crea el usuario en auth.users; el trigger `on_auth_user_created`
 * genera automáticamente su fila en `profiles`.
 */
export async function createUserAction(input: {
  email: string;
  nombre: string;
  rol: Rol;
  jerarquia: Jerarquia;
  password: string;
}): Promise<ActionResult> {
  try {
    await assertIsAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const email = input.email.trim().toLowerCase();
  if (!email.endsWith("@comafi.com.ar")) {
    return { ok: false, error: "El email debe pertenecer al dominio @comafi.com.ar." };
  }
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      nombre: input.nombre,
      rol: input.rol,
      jerarquia: input.jerarquia,
    },
  });

  if (error) {
    return { ok: false, error: `No se pudo crear el usuario: ${error.message}` };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function updateUserAction(input: {
  userId: string;
  rol: Rol;
  jerarquia: Jerarquia;
  activo: boolean;
}): Promise<ActionResult> {
  try {
    await assertIsAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ rol: input.rol, jerarquia: input.jerarquia, activo: input.activo })
    .eq("id", input.userId);

  if (error) return { ok: false, error: "No se pudo actualizar el usuario." };

  revalidatePath("/admin/usuarios");
  return { ok: true };
}
