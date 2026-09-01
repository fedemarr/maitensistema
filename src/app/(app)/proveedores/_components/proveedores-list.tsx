"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProveedorListItem } from "@/features/proveedores/queries";

export function ProveedoresList({
  proveedores,
  editable,
}: {
  proveedores: ProveedorListItem[];
  editable: boolean;
}) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return proveedores;
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(t) ||
        (p.email ?? "").toLowerCase().includes(t) ||
        (p.telefono ?? "").includes(t),
    );
  }, [q, proveedores]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar por nombre, email o teléfono…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>CUIT</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {proveedores.length === 0
                    ? "Todavía no hay proveedores."
                    : "Sin resultados para la búsqueda."}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/proveedores/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.nombre}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{p.cuit ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.email ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.telefono ?? "—"}</TableCell>
                  <TableCell>
                    {p.activo ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editable ? (
        <p className="text-xs text-muted-foreground">
          Tocá un proveedor para ver su ficha y editarlo.
        </p>
      ) : null}
    </div>
  );
}
