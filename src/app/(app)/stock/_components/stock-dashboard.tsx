"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { verificarStock, type DiferenciaStock } from "@/features/stock/actions";
import type { FilaStock } from "@/features/stock/queries";
import type { Rubro } from "@/features/rubros/queries";
import { fmtMoney, fmtNumber } from "@/lib/format";

const SIN_RUBRO = "__none__";

const ESTADO_BADGE = {
  ok: <Badge variant="secondary">OK</Badge>,
  bajo: <Badge>Bajo mínimo</Badge>,
  sin: <Badge variant="destructive">Sin stock</Badge>,
} as const;

export function StockDashboard({
  filas,
  rubros,
  esAdmin,
}: {
  filas: FilaStock[];
  rubros: Rubro[];
  esAdmin: boolean;
}) {
  const [q, setQ] = useState("");
  const [rubro, setRubro] = useState<string>("");
  const [verificando, startVerificar] = useTransition();
  const [resultado, setResultado] = useState<{
    revisados: number;
    diferencias: DiferenciaStock[];
  } | null>(null);

  const rubroItems = [
    { label: "Todos los rubros", value: SIN_RUBRO },
    ...rubros.map((r) => ({ label: r.nombre, value: r.nombre })),
  ];

  const filtradas = useMemo(() => {
    let result = filas;
    const t = q.trim().toLowerCase();
    if (t) {
      result = result.filter(
        (f) =>
          f.productoNombre.toLowerCase().includes(t) ||
          f.varianteNombre.toLowerCase().includes(t),
      );
    }
    if (rubro) result = result.filter((f) => f.rubro === rubro);
    return result;
  }, [q, rubro, filas]);

  const totales = useMemo(() => {
    const bajo = filas.filter((f) => f.estado === "bajo").length;
    const sin = filas.filter((f) => f.estado === "sin").length;
    const valor = filas.reduce((acc, f) => acc + f.valorCosto, 0);
    return { total: filas.length, bajo, sin, valor };
  }, [filas]);

  function onVerificar() {
    setResultado(null);
    startVerificar(async () => {
      const res = await verificarStock();
      if (!res.ok) {
        toast.error("No tenés permiso para verificar el stock.");
      } else {
        setResultado({ revisados: res.revisados, diferencias: res.diferencias });
        toast.success(
          res.diferencias.length === 0
            ? "Stock consistente: sin diferencias."
            : `${res.diferencias.length} variante(s) con diferencia.`,
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile titulo="Variantes activas" valor={fmtNumber(totales.total)} detalle="Total del inventario" />
        <Tile titulo="Bajo mínimo" valor={fmtNumber(totales.bajo)} detalle="Faltan para el mínimo" />
        <Tile titulo="Sin stock" valor={fmtNumber(totales.sin)} detalle="Agotadas" />
        <Tile titulo="Valor del inventario" valor={fmtMoney(totales.valor)} detalle="Stock × costo promedio" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <Input
                placeholder="Buscar producto o variante…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="max-w-xs"
              />
              <Select
                items={rubroItems}
                value={rubro || SIN_RUBRO}
                onValueChange={(v) => setRubro(!v || v === SIN_RUBRO ? "" : String(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rubroItems.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {it.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {esAdmin ? (
              <Button
                variant="outline"
                onClick={onVerificar}
                disabled={verificando}
              >
                {verificando ? "Verificando…" : "Verificar stock"}
              </Button>
            ) : null}
          </div>

          {resultado ? (
            <div
              className={`rounded-lg border p-3 text-sm ${
                resultado.diferencias.length === 0
                  ? "border-transparent bg-muted/50"
                  : "border-destructive/40 bg-destructive/5"
              }`}
            >
              <p>
                Chequeo sobre {fmtNumber(resultado.revisados)} variante(s) con
                movimientos:{" "}
                {resultado.diferencias.length === 0 ? (
                  <span className="font-medium">sin diferencias.</span>
                ) : (
                  <span className="font-medium text-destructive">
                    {resultado.diferencias.length} variante(s) difieren.
                  </span>
                )}
              </p>
              {resultado.diferencias.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                  {resultado.diferencias.map((d) => (
                    <li key={d.varianteId}>
                      {d.productoNombre} — {d.varianteNombre}: stock real{" "}
                      {fmtNumber(d.stockReal)}, esperado{" "}
                      {fmtNumber(d.stockEsperado)} ({"Δ"}
                      {d.diferencia > 0 ? "+" : ""}
                      {d.diferencia}).
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Rubro</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Valor a costo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {filas.length === 0
                        ? "Todavía no hay variantes."
                        : "Sin resultados para el filtro."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((f) => (
                    <TableRow key={f.varianteId}>
                      <TableCell>
                        <Link
                          href={`/productos/${f.productoId}`}
                          className="font-medium hover:underline"
                        >
                          {f.productoNombre}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{f.varianteNombre}</TableCell>
                      <TableCell className="text-xs">{f.rubro ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(f.stock)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(f.stockMin)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(f.valorCosto)}
                      </TableCell>
                      <TableCell>{ESTADO_BADGE[f.estado]}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: string;
  detalle: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{valor}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </CardContent>
    </Card>
  );
}