"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./reservations";
import type { Jerarquia, Rol } from "@/lib/database.types";

/**
 * Duración de baneo usada para reflejar `profiles.activo = false` también en
 * Supabase Auth (GoTrue rechaza logins y refresh de tokens de usuarios
 * baneados). Es el enforcement real: sin esto, un usuario desactivado solo
 * quedaba bloqueado en /admin y /invitados (chequeo en el proxy), pero podía
 * seguir usando el resto de la app hasta que su sesión expirara.
 */
const BAN_DURATION_INDEFINIDO = "876000h"; // ~100 años, valor sugerido por la doc de Supabase.
const BAN_DURATION_NINGUNO = "none";

/**
 * Traduce errores de Supabase/Postgres a mensajes claros en español.
 */
function describeDbError(error: { message: string; code?: string }, accion: string): string {
  const msg = error.message ?? "";

  if (error.code === "23505" || /duplicate key/i.test(msg)) {
    return `No se pudo ${accion}: ya existe un registro con ese valor.`;
  }
  if (error.code === "42P01" || /relation .* does not exist/i.test(msg) || /schema cache/i.test(msg)) {
    return `No se pudo ${accion}: falta aplicar una migración en la base (${msg}).`;
  }
  if (/permission denied|policy/i.test(msg)) {
    return `No se pudo ${accion}: la base rechazó la operación por políticas de seguridad (RLS).`;
  }
  return `No se pudo ${accion}: ${msg}`;
}

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

  return userData.user.id;
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

/**
 * Edición completa de un usuario desde /admin/usuarios: nombre, rol,
 * jerarquía y estado activo/inactivo. Incluye protecciones para que un
 * admin no pueda desactivarse ni quitarse el rol admin a sí mismo (evita
 * dejar el sistema sin ningún administrador con acceso).
 */
export async function updateUserAction(input: {
  userId: string;
  nombre: string;
  rol: Rol;
  jerarquia: Jerarquia;
  activo: boolean;
}): Promise<ActionResult> {
  let adminId: string;
  try {
    adminId = await assertIsAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const nombre = input.nombre.trim();
  if (!nombre) {
    return { ok: false, error: "El nombre no puede estar vacío." };
  }

  if (input.userId === adminId) {
    if (!input.activo) {
      return { ok: false, error: "No podés desactivarte a vos mismo." };
    }
    if (input.rol !== "admin") {
      return { ok: false, error: "No podés quitarte el rol de administrador a vos mismo." };
    }
  }

  const supabase = await createClient();

  // Estado anterior, para saber si `activo` cambió y hay que sincronizar el
  // baneo en Supabase Auth.
  const { data: previo } = await supabase
    .from("profiles")
    .select("activo")
    .eq("id", input.userId)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ nombre, rol: input.rol, jerarquia: input.jerarquia, activo: input.activo })
    .eq("id", input.userId);

  if (error) return { ok: false, error: describeDbError(error, "actualizar el usuario") };

  if (previo && previo.activo !== input.activo) {
    const admin = createAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(input.userId, {
      ban_duration: input.activo ? BAN_DURATION_NINGUNO : BAN_DURATION_INDEFINIDO,
    });
    if (banError) {
      return {
        ok: false,
        error: `El perfil se actualizó pero no se pudo sincronizar el bloqueo en Supabase Auth: ${banError.message}`,
      };
    }
  }

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${input.userId}`);
  return { ok: true };
}

/**
 * Restablece la contraseña de un usuario usando la Admin API (service
 * role). Pensado para comunicar la contraseña provisoria por un canal
 * seguro (no queda registrada en ningún lado de la app).
 */
export async function resetPasswordAction(input: {
  userId: string;
  newPassword: string;
}): Promise<ActionResult> {
  try {
    await assertIsAdmin();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  if (!input.newPassword || input.newPassword.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(input.userId, {
    password: input.newPassword,
  });

  if (error) {
    return { ok: false, error: `No se pudo restablecer la contraseña: ${error.message}` };
  }

  return { ok: true };
}
