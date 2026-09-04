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
import type { ClienteListItem } from "@/features/clientes/queries";
import { TIPO_LABEL, tipoClienteEnum } from "@/features/clientes/schema";
import { fmtMoney, fmtNumber } from "@/lib/format";

const SIN_TIPO = "__none__";

export function ClientesList({
  clientes,
  editable,
}: {
  clientes: ClienteListItem[];
  editable: boolean;
}) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<string>("");

  const tipoItems = [
    { label: "Todos los tipos", value: SIN_TIPO },
    ...tipoClienteEnum.map((t) => ({ label: TIPO_LABEL[t], value: t })),
  ];

  const filtrados = useMemo(() => {
    let result = clientes;
    const t = q.trim().toLowerCase();
    if (t) {
      result = result.filter(
        (c) =>
          c.nombre.toLowerCase().includes(t) ||
          (c.email ?? "").toLowerCase().includes(t) ||
          (c.telefono ?? "").includes(t),
      );
    }
    if (tipo) {
      result = result.filter((c) => c.tipo === tipo);
    }
    return result;
  }, [q, tipo, clientes]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nombre, email o teléfono…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Select
          items={tipoItems}
          value={tipo || SIN_TIPO}
          onValueChange={(v) => setTipo(!v || v === SIN_TIPO ? "" : String(v))}
        >
          <SelectTrigger className="w-[180px]">
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
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Compró (u)</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
              <TableHead className="text-right">En consig.</TableHead>
              <TableHead className="text-right">Saldo cta. cte.</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {clientes.length === 0
                    ? "Todavía no hay clientes."
                    : "Sin resultados para la búsqueda."}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/clientes/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.nombre}
                    </Link>
                  </TableCell>
                  <TableCell>{TIPO_LABEL[c.tipo as keyof typeof TIPO_LABEL] ?? c.tipo}</TableCell>
                  <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.comproUnidades ? fmtNumber(c.comproUnidades) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.ingresos ? fmtMoney(c.ingresos) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.enConsignacion ? fmtNumber(c.enConsignacion) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.saldoCc > 0 ? (
                      <span className="text-destructive">
                        {fmtMoney(c.saldoCc)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {c.activo ? (
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
          Tocá un cliente para ver su ficha y editarlo.
        </p>
      ) : null}
    </div>
  );
}
