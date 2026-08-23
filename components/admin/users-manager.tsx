"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createUserAction, updateUserAction } from "@/app/actions/admin-users";
import type { Jerarquia, Profile, Rol } from "@/lib/database.types";

export function UsersManager({ profiles }: { profiles: Profile[] }) {
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
            <div>
              <Label>Email corporativo</Label>
              <Input
                type="email"
                placeholder="nombre.apellido@comafi.com.ar"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Nombre completo</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div>
              <Label>Rol</Label>
              <Select value={rol} onValueChange={(v) => setRol(v as Rol)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jerarquía</Label>
              <Select value={jerarquia} onValueChange={(v) => setJerarquia(v as Jerarquia)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="directivo">Directivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Contraseña provisoria</Label>
              <Input
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
                <TableHead>Activo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <UserRow key={p.id} profile={p} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [rol, setRol] = useState<Rol>(profile.rol);
  const [jerarquia, setJerarquia] = useState<Jerarquia>(profile.jerarquia);
  const [activo, setActivo] = useState(profile.activo);
  const [saving, setSaving] = useState(false);

  async function persist(next: { rol?: Rol; jerarquia?: Jerarquia; activo?: boolean }) {
    setSaving(true);
    const res = await updateUserAction({
      userId: profile.id,
      rol: next.rol ?? rol,
      jerarquia: next.jerarquia ?? jerarquia,
      activo: next.activo ?? activo,
    });
    setSaving(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{profile.nombre}</TableCell>
      <TableCell>{profile.email}</TableCell>
      <TableCell>
        <Select
          value={rol}
          onValueChange={(v) => {
            setRol(v as Rol);
            persist({ rol: v as Rol });
          }}
          disabled={saving}
        >
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="colaborador">Colaborador</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={jerarquia}
          onValueChange={(v) => {
            setJerarquia(v as Jerarquia);
            persist({ jerarquia: v as Jerarquia });
          }}
          disabled={saving}
        >
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="colaborador">Colaborador</SelectItem>
            <SelectItem value="gerente">Gerente</SelectItem>
            <SelectItem value="directivo">Directivo</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={activo}
            disabled={saving}
            onCheckedChange={(v) => {
              setActivo(v);
              persist({ activo: v });
            }}
          />
          {!activo && <Badge variant="muted">Inactivo</Badge>}
        </div>
      </TableCell>
    </TableRow>
  );
}
