"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ESTADO_CONSIG_LABEL,
  type ConsignacionRow,
  type EstadoConsignacion,
} from "@/features/consignaciones/schema";
import { fmtDate, fmtNumber } from "@/lib/format";

const VARIANT: Record<EstadoConsignacion, "secondary" | "outline" | "destructive"> =
  {
    abierta: "outline",
    parcial: "outline",
    vencida: "destructive",
    cerrada: "secondary",
  };

export function ConsignacionesTabla({
  rows,
  editable,
}: {
  rows: ConsignacionRow[];
  editable: boolean;
}) {
  const [estado, setEstado] = useState("todas");
  const filtradas =
    estado === "todas" ? rows : rows.filter((r) => r.estado === estado);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          items={[
            { label: "Todas", value: "todas" },
            ...Object.entries(ESTADO_CONSIG_LABEL).map(([v, l]) => ({
              label: l,
              value: v,
            })),
          ]}
          value={estado}
          onValueChange={(v) => setEstado(v ?? "todas")}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {Object.entries(ESTADO_CONSIG_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {editable ? (
          <Button
            render={<Link href="/movimientos/nuevo?tipo=consignacion" />}
          >
            Nueva consignación
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right">Entreg.</TableHead>
              <TableHead className="text-right">Vend.</TableHead>
              <TableHead className="text-right">Devu.</TableHead>
              <TableHead className="text-right">Pend.</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin consignaciones.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.cliente}</TableCell>
                  <TableCell>{c.producto}</TableCell>
                  <TableCell className="font-mono text-xs">{c.lote}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNumber(c.entregadas)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.vendidas || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.devueltas || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {c.pendientes || "—"}
                  </TableCell>
                  <TableCell
                    className={
                      c.estado === "vencida"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {fmtDate(c.vence)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={VARIANT[c.estado]}>
                      {ESTADO_CONSIG_LABEL[c.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {editable && c.pendientes > 0 ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          render={
                            <Link
                              href={`/movimientos/nuevo?tipo=venta_consignacion&cliente=${c.clienteId}&producto=${c.productoId}&cantidad=${c.pendientes}`}
                            />
                          }
                        >
                          Registrar venta
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <Link
                              href={`/movimientos/nuevo?tipo=devolucion_consignacion&cliente=${c.clienteId}&producto=${c.productoId}&cantidad=${c.pendientes}`}
                            />
                          }
                        >
                          Devolución
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
