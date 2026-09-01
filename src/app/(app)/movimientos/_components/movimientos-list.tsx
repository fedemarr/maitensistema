"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import type { MovimientoListItem } from "@/features/movimientos/queries";
import { signoDe, TIPO_LABEL, TIPO_MOVIMIENTO } from "@/features/movimientos/schema";
import { fmtDate, fmtMoney } from "@/lib/format";

const SIN_TIPO = "__none__";

function terceroNombre(m: MovimientoListItem): string {
  if (m.tipo === "ingreso") return m.proveedor?.nombre ?? "—";
  return m.cliente?.nombre ?? "—";
}

function FamiliaBadge({ tipo }: { tipo: MovimientoListItem["tipo"] }) {
  const signo = signoDe(tipo);
  if (signo === "ajuste") return <Badge variant="outline">Ajuste</Badge>;
  if (signo === 1) return <Badge variant="secondary">Entrada</Badge>;
  return tipo === "venta" ? (
    <Badge>Venta</Badge>
  ) : (
    <Badge variant="destructive">Salida</Badge>
  );
}

export function MovimientosList({
  movimientos,
}: {
  movimientos: MovimientoListItem[];
}) {
  const [tipo, setTipo] = useState<string>("");
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Select
          items={tipoItems}
          value={tipo || SIN_TIPO}
          onValueChange={(v) => setTipo(!v || v === SIN_TIPO ? "" : String(v))}
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

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tercero</TableHead>
              <TableHead>Ítems</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {movimientos.length === 0
                    ? "Todavía no hay movimientos."
                    : "Sin resultados para el filtro."}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link
                      href={`/movimientos/${m.id}`}
                      className="font-medium hover:underline"
                    >
                      {fmtDate(m.fecha)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FamiliaBadge tipo={m.tipo} />
                      <span className="text-sm">{TIPO_LABEL[m.tipo]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{terceroNombre(m)}</TableCell>
                  <TableCell className="text-sm">
                    {m.items.length}{" "}
                    {m.items.length === 1 ? "ítem" : "ítems"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtMoney(m.total)}
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
