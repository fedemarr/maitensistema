"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { MovimientoProducto } from "@/features/productos/queries";
import {
  signoDe,
  TIPO_LABEL,
  TIPO_MOVIMIENTO,
} from "@/features/movimientos/schema";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";

const SIN_TIPO = "__none__";

function deltaDe(m: MovimientoProducto, esInsumo: boolean): number {
  const s = signoDe(m.tipo);
  if (s === "ajuste") return m.cantidad;
  // En producción, el insumo se consume (−) y el terminado se genera (+).
  if (s === "produccion") return esInsumo ? -m.cantidad : m.cantidad;
  return s * m.cantidad;
}

const SIGNOS_SALIDA = new Set(["venta", "consignacion", "canje", "presentacion", "regalo", "rotura"]);

export function HistoricoMovimientos({
  movimientos,
  esInsumo = false,
}: {
  movimientos: MovimientoProducto[];
  esInsumo?: boolean;
}) {
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const tipoItems = [
    { label: "Todos los tipos", value: SIN_TIPO },
    ...TIPO_MOVIMIENTO.map((t) => ({ label: TIPO_LABEL[t], value: t })),
  ];

  const filtrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (tipo && m.tipo !== tipo) return false;
      if (desde && m.fecha < desde) return false;
      if (hasta && m.fecha > hasta) return false;
      return true;
    });
  }, [movimientos, tipo, desde, hasta]);

  const resumen = useMemo(() => {
    const porTipo = new Map<
      MovimientoProducto["tipo"],
      { unidades: number; esSalida: boolean }
    >();
    let totalSalidas = 0;
    for (const m of filtrados) {
      const s = signoDe(m.tipo);
      const unidades = s === "ajuste" ? Math.abs(m.cantidad) : m.cantidad;
      const esSalida = SIGNOS_SALIDA.has(m.tipo);
      const prev = porTipo.get(m.tipo) ?? { unidades: 0, esSalida };
      prev.unidades += unidades;
      if (esSalida) totalSalidas += unidades;
      porTipo.set(m.tipo, prev);
    }
    return { porTipo, totalSalidas };
  }, [filtrados]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Movimientos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select
            items={tipoItems}
            value={tipo || SIN_TIPO}
            onValueChange={(v) =>
              setTipo(!v || v === SIN_TIPO ? "" : String(v))
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tipoItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-[160px]"
            aria-label="Desde"
          />
          <Input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-[160px]"
            aria-label="Hasta"
          />
        </div>

        {resumen.porTipo.size > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...resumen.porTipo.entries()].map(([t, info]) => (
              <div
                key={t}
                className="rounded-lg border bg-muted/40 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{TIPO_LABEL[t]}</p>
                  {info.esSalida && resumen.totalSalidas > 0 ? (
                    <Badge variant="outline">
                      {fmtNumber(
                        Math.round((info.unidades / resumen.totalSalidas) * 100),
                      )}
                      % salidas
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {fmtNumber(info.unidades)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Unidades</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {movimientos.length === 0
                      ? "Este producto todavía no tiene movimientos."
                      : "Sin movimientos para el filtro."}
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((m) => {
                  const delta = deltaDe(m, esInsumo);
                  return (
                    <TableRow key={m.itemId}>
                      <TableCell className="text-xs tabular-nums">
                        {fmtDate(m.fecha)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/movimientos/${m.movimientoId}`}
                          className="font-medium hover:underline"
                        >
                          {TIPO_LABEL[m.tipo]}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.varianteNombre}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          delta < 0 ? "text-muted-foreground" : ""
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {fmtNumber(delta)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.clienteNombre ?? m.proveedorNombre ?? ""}
                        {m.medioPago ? ` · ${m.medioPago}` : ""}
                        {m.notas ? ` · ${m.notas}` : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {fmtMoney(
                          m.tipo === "ingreso"
                            ? Number(m.costoUnit) * m.cantidad
                            : Number(m.precioUnit) * m.cantidad,
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}