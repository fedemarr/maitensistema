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
import type { ProductoListItem } from "@/features/productos/queries";
import { fmtMoney, fmtNumber } from "@/lib/format";

export function ProductosList({
  productos,
}: {
  productos: ProductoListItem[];
}) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return productos;
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(t) ||
        p.sku.toLowerCase().includes(t) ||
        (p.rubro ?? "").toLowerCase().includes(t),
    );
  }, [q, productos]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar por nombre, SKU o rubro…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Rubro</TableHead>
              <TableHead className="text-right">Depósito</TableHead>
              <TableHead className="text-right">PPP</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {productos.length === 0
                    ? "Todavía no hay productos."
                    : "Sin resultados."}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/productos/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.nombre}
                    </Link>
                    {p.presentacion ? (
                      <span className="text-xs text-muted-foreground">
                        {" · "}
                        {p.presentacion}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>{p.rubro ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNumber(p.stockDeposito)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(p.ppp)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.activo ? (
                        <Badge variant="secondary">Activo</Badge>
                      ) : (
                        <Badge variant="outline">Inactivo</Badge>
                      )}
                      {!p.tieneReceta ? (
                        <Badge variant="outline" className="text-destructive">
                          Sin receta
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
