"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createUserAction,
  updateUserAction,
  resetPasswordAction,
} from "@/app/actions/admin-users";
import { ROL_LABEL } from "@/components/user-profile-sections";
import type { Jerarquia, Profile, Rol } from "@/lib/database.types";

const JERARQUIA_LABEL: Record<Jerarquia, string> = {
  colaborador: "Colaborador",
  gerente: "Gerente",
  directivo: "Directivo",
};

export function UsersManager({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("colaborador");
  const [jerarquia, setJerarquia] = useState<Jerarquia>("colaborador");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const res = await createUserAction({ email, nombre, rol, jerarquia, password });
    setLoading(false);

    if (!res.ok) {
      setError(res.error || "No se pudo crear el usuario.");
      return;
    }
    setSuccess(true);
    setEmail("");
    setNombre("");
    setPassword("");
    setRol("colaborador");
    setJerarquia("colaborador");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Alta manual de usuario</CardTitle>
          <CardDescription>
            Se crea en Supabase Auth con la Admin API (service role, solo en el servidor). No hay
            self-signup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-email">Email corporativo</Label>
              <Input
                id="u-email"
                type="email"
                placeholder="nombre.apellido@comafi.com.ar"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-nombre">Nombre completo</Label>
              <Input id="u-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-rol">Rol</Label>
              <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
                <SelectTrigger id="u-rol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{ROL_LABEL.admin}</SelectItem>
                  <SelectItem value="asistente">{ROL_LABEL.asistente}</SelectItem>
                  <SelectItem value="colaborador">{ROL_LABEL.colaborador}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="u-jerarquia">Jerarquía</Label>
              <Select value={jerarquia} onValueChange={(v) => setJerarquia(v as Jerarquia)}>
                <SelectTrigger id="u-jerarquia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="directivo">Directivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="u-password">Contraseña provisoria</Label>
              <Input
                id="u-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            {error && (
              <p role="alert" className="sm:col-span-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="sm:col-span-2 text-sm text-success bg-success/10 rounded-md px-3 py-2">
                Usuario creado correctamente.
              </p>
            )}

            <Button type="submit" disabled={loading} className="sm:col-span-2 self-start">
              {loading ? "Creando..." : "Crear usuario"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Jerarquía</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <UserRow key={p.id} profile={p} isSelf={p.id === currentUserId} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          href={`/admin/usuarios/${profile.id}`}
          className="focus-ring text-primary hover:underline"
        >
          {profile.nombre}
        </Link>
      </TableCell>
      <TableCell>{profile.email}</TableCell>
      <TableCell>
        <Badge variant={profile.rol === "admin" ? "default" : "secondary"}>
          {ROL_LABEL[profile.rol]}
        </Badge>
      </TableCell>
      <TableCell>{JERARQUIA_LABEL[profile.jerarquia]}</TableCell>
      <TableCell>
        {profile.activo ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="muted">Inactivo</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Editar
        </Button>
        <EditUserDialog
          profile={profile}
          isSelf={isSelf}
          open={open}
          onOpenChange={setOpen}
        />
      </TableCell>
    </TableRow>
  );
}

function EditUserDialog({
  profile,
  isSelf,
  open,
  onOpenChange,
}: {
  profile: Profile;
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(profile.nombre);
  const [rol, setRol] = useState<Rol>(profile.rol);
  const [jerarquia, setJerarquia] = useState<Jerarquia>(profile.jerarquia);
  const [activo, setActivo] = useState(profile.activo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  function resetLocalState() {
    setNombre(profile.nombre);
    setRol(profile.rol);
    setJerarquia(profile.jerarquia);
    setActivo(profile.activo);
    setError(null);
    setSuccess(false);
    setNewPassword("");
    setResetError(null);
    setResetSuccess(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetLocalState();
    onOpenChange(next);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await updateUserAction({ userId: profile.id, nombre, rol, jerarquia, activo });
    setSaving(false);

    if (!res.ok) {
      setError(res.error || "No se pudo actualizar el usuario.");
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) return;

    if (
      !window.confirm(
        "¿Confirmás el restablecimiento de la contraseña? Comunicá la nueva contraseña provisoria a la persona por un canal seguro (no por este medio ni por email sin cifrar)."
      )
    ) {
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetSuccess(false);

    const res = await resetPasswordAction({ userId: profile.id, newPassword });
    setResetLoading(false);

    if (!res.ok) {
      setResetError(res.error || "No se pudo restablecer la contraseña.");
      return;
    }
    setResetSuccess(true);
    setNewPassword("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>{profile.email}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="e-nombre">Nombre completo</Label>
            <Input id="e-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-rol">Rol</Label>
              <Select value={rol} onValueChange={(v) => setRol(v as Rol)} disabled={isSelf}>
                <SelectTrigger id="e-rol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{ROL_LABEL.admin}</SelectItem>
                  <SelectItem value="asistente">{ROL_LABEL.asistente}</SelectItem>
                  <SelectItem value="colaborador">{ROL_LABEL.colaborador}</SelectItem>
                </SelectContent>
              </Select>
              {isSelf && (
                <p className="text-xs text-muted-foreground">
                  No podés cambiar tu propio rol de administrador.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-jerarquia">Jerarquía</Label>
              <Select value={jerarquia} onValueChange={(v) => setJerarquia(v as Jerarquia)}>
                <SelectTrigger id="e-jerarquia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="directivo">Directivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={activo}
              disabled={isSelf}
              aria-label={`Usuario activo: ${profile.nombre}`}
              onCheckedChange={setActivo}
            />
            <span className="text-sm">Usuario activo</span>
            {isSelf && (
              <span className="text-xs text-muted-foreground">(no podés desactivarte a vos mismo)</span>
            )}
          </div>
          {!activo && (
            <p className="text-xs text-muted-foreground">
              Al desactivar, además de marcarlo en el perfil se bloquea el usuario en Supabase Auth
              (no va a poder iniciar sesión y, si tiene una sesión abierta, se cierra en el próximo
              request).
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-success bg-success/10 rounded-md px-3 py-2">
              Usuario actualizado correctamente.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cerrar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>

        <div className="mt-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Restablecer contraseña</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Define una contraseña provisoria nueva para este usuario. Comunicásela por un canal
            seguro (no por email sin cifrar ni chat); a diferencia de otros datos, la app no la
            guarda ni la muestra en ningún lado después de este paso.
          </p>
          <form onSubmit={handleResetPassword} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="e-password">Contraseña provisoria nueva</Label>
              <Input
                id="e-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <Button type="submit" variant="outline" disabled={resetLoading || !newPassword}>
              {resetLoading ? "Restableciendo..." : "Restablecer"}
            </Button>
          </form>
          {resetError && (
            <p role="alert" className="mt-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {resetError}
            </p>
          )}
          {resetSuccess && (
            <p className="mt-2 text-sm text-success bg-success/10 rounded-md px-3 py-2">
              Contraseña restablecida. Comunicásela por un canal seguro.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
