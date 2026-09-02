"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  cambiarRol,
  invitarUsuario,
  toggleUsuarioActivo,
} from "@/features/usuarios/actions";
import type { UsuarioListItem } from "@/features/usuarios/queries";
import { ROL_LABEL, ROLES, type RolUsuario } from "@/features/usuarios/schema";
import { fmtDate } from "@/lib/format";

const rolItems = ROLES.map((r) => ({ label: ROL_LABEL[r], value: r }));

export function UsuariosPanel({
  usuarios,
  miId,
}: {
  usuarios: UsuarioListItem[];
  miId: string;
}) {
  const [pending, start] = useTransition();

  // Alta
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<RolUsuario>("ventas");

  function invitar(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await invitarUsuario({ email, nombre, rol });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Invitación enviada por email.");
      setEmail("");
      setNombre("");
    });
  }

  function onRol(id: string, nuevo: RolUsuario) {
    start(async () => {
      const res = await cambiarRol(id, nuevo);
      if (!res.ok) toast.error(res.error);
      else toast.success("Rol actualizado.");
    });
  }

  function onActivo(id: string, activo: boolean) {
    start(async () => {
      const res = await toggleUsuarioActivo(id, activo);
      if (!res.ok) toast.error(res.error);
      else toast.success(activo ? "Usuario activado." : "Usuario desactivado.");
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invitar usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={invitar} className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Rol</Label>
              <Select
                items={rolItems}
                value={rol}
                onValueChange={(v) => setRol((v as RolUsuario) ?? "ventas")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rolItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {it.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={pending}>
              Invitar
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Recibe un email con un enlace para crear su contraseña.
          </p>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id} className={u.activo ? "" : "opacity-55"}>
                <TableCell className="font-medium">
                  {u.nombre}
                  {u.id === miId ? (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (vos)
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.email ?? "—"}
                </TableCell>
                <TableCell>
                  <Select
                    items={rolItems}
                    value={u.rol}
                    onValueChange={(v) =>
                      onRol(u.id, (v as RolUsuario) ?? u.rol)
                    }
                  >
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rolItems.map((it) => (
                        <SelectItem key={it.value} value={it.value}>
                          {it.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.ultimoAcceso ? fmtDate(u.ultimoAcceso) : "nunca"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {u.activo ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                    {u.id !== miId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => onActivo(u.id, !u.activo)}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
