"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import type { MovimientoRow } from "@/features/movimientos/queries";
import { TIPO_LABEL } from "@/features/movimientos/schema";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";

const ENTRA = new Set(["produccion", "devolucion_consignacion"]);

export function MovimientosHistorial({ rows }: { rows: MovimientoRow[] }) {
  const [tipo, setTipo] = useState("todos");
  const [prod, setProd] = useState("todos");

  const productos = useMemo(
    () => [...new Set(rows.map((r) => r.producto))].sort(),
    [rows],
  );

  const filtrados = rows.filter((r) => {
    if (tipo !== "todos" && r.tipo !== tipo) return false;
    if (prod !== "todos" && r.producto !== prod) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select
          items={[
            { label: "Todos los tipos", value: "todos" },
            ...Object.entries(TIPO_LABEL).map(([v, l]) => ({
              label: l,
              value: v,
            })),
          ]}
          value={tipo}
          onValueChange={(v) => setTipo(v ?? "todos")}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {Object.entries(TIPO_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={[
            { label: "Todos los productos", value: "todos" },
            ...productos.map((p) => ({ label: p, value: p })),
          ]}
          value={prod}
          onValueChange={(v) => setProd(v ?? "todos")}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los productos</SelectItem>
            {productos.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente / destino</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Ingreso</TableHead>
              <TableHead className="text-right">Costo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin movimientos.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((r) => {
                const entra = ENTRA.has(r.tipo);
                const neutro =
                  r.tipo === "consignacion" ||
                  r.tipo === "devolucion_consignacion";
                return (
                  <TableRow key={r.itemId}>
                    <TableCell>{fmtDate(r.fecha)}</TableCell>
                    <TableCell className="font-medium">{r.producto}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {TIPO_LABEL[r.tipo] ?? r.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.cliente ?? "—"}
                      {r.medioPago ? (
                        <span className="block text-[11px]">{r.medioPago}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.lotes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          neutro
                            ? "text-muted-foreground"
                            : entra
                              ? "text-[var(--color-chart-1)]"
                              : "text-destructive"
                        }
                      >
                        {entra ? "+" : r.cantidad < 0 ? "" : "−"}
                        {fmtNumber(Math.abs(r.cantidad))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.ingresoNeto) ? fmtMoney(r.ingresoNeto) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.costo) ? fmtMoney(r.costo) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
