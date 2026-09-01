"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { crearRubro, toggleRubroActivo } from "@/features/rubros/actions";
import type { Rubro } from "@/features/rubros/queries";

export function RubrosManager({
  rubros,
  editable,
}: {
  rubros: Rubro[];
  editable: boolean;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [pending, startTransition] = useTransition();

  function onCrear(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await crearRubro(nombre);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNombre("");
      toast.success("Rubro creado.");
      router.refresh();
    });
  }

  function onToggle(id: string, activo: boolean) {
    startTransition(async () => {
      await toggleRubroActivo(id, activo);
      toast.success(activo ? "Rubro desactivado." : "Rubro activado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {editable ? (
        <form onSubmit={onCrear} className="flex gap-2">
          <Input
            placeholder="Nombre del rubro (ej: Capilar)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Creando…" : "Crear rubro"}
          </Button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              {editable ? <TableHead>Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rubros.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={editable ? 3 : 2}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Todavía no hay rubros.
                </TableCell>
              </TableRow>
            ) : (
              rubros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nombre}</TableCell>
                  <TableCell>
                    {r.activo ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </TableCell>
                  {editable ? (
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onToggle(r.id, r.activo)}
                        disabled={pending}
                      >
                        {r.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editable ? (
        <p className="text-xs text-muted-foreground">
          Los rubros inactivos dejan de aparecer en el select de Productos.
        </p>
      ) : null}
    </div>
  );
}
