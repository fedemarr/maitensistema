"use client";

import Link from "next/link";
import { useState } from "react";
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
import { setStockMinimo, verificarStock } from "@/features/stock/actions";
import type { StockProducto } from "@/features/stock/queries";
import { fmtMoney, fmtNumber } from "@/lib/format";

const BADGE = {
  ok: { label: "OK", variant: "secondary" as const },
  reponer: { label: "Reponer", variant: "outline" as const },
  sin: { label: "Sin stock", variant: "destructive" as const },
};

export function StockTabla({
  productos,
  editable,
  esAdmin,
}: {
  productos: StockProducto[];
  editable: boolean;
  esAdmin: boolean;
}) {
  const [minimos, setMinimos] = useState<Record<string, string>>(
    Object.fromEntries(productos.map((p) => [p.id, String(p.minimo)])),
  );
  const [verificando, setVerificando] = useState(false);

  async function guardarMin(id: string) {
    const v = Number(minimos[id] ?? 0);
    const res = await setStockMinimo(id, v);
    if (res.ok) toast.success("Mínimo actualizado.");
  }

  async function verificar() {
    setVerificando(true);
    const res = await verificarStock();
    setVerificando(false);
    if (res.diferencias.length === 0) {
      toast.success(
        `Verificación OK · ${res.revisados} filas, sin diferencias.`,
      );
    } else {
      toast.error(
        `${res.diferencias.length} diferencia(s): ${res.diferencias
          .map((d) => `${d.producto}/${d.lote} (${d.diferencia})`)
          .join(", ")}`,
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        {esAdmin ? (
          <Button variant="outline" onClick={verificar} disabled={verificando}>
            {verificando ? "Verificando…" : "Verificar stock"}
          </Button>
        ) : null}
        {editable ? (
          <Button render={<Link href="/movimientos/nuevo" />}>
            Nuevo movimiento
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Código</TableHead>
              <TableHead className="text-right">En depósito</TableHead>
              <TableHead className="text-right">En consignación</TableHead>
              <TableHead className="text-right">Total propio</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">PPP</TableHead>
              <TableHead className="text-right">Valor a costo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin productos terminados.
                </TableCell>
              </TableRow>
            ) : (
              productos.map((p) => {
                const b = BADGE[p.estado];
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/productos/${p.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.nombre}
                      </Link>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {p.lotes.length
                          ? p.lotes
                              .map(
                                (l) =>
                                  `${l.lote}: ${fmtNumber(l.unidades)}`,
                              )
                              .join(" · ")
                          : "sin stock en depósito"}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNumber(p.enDeposito)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.enConsignacion > 0 ? (
                        fmtNumber(p.enConsignacion)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {fmtNumber(p.totalPropio)}
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Input
                          type="number"
                          min="0"
                          className="ml-auto h-8 w-20 text-right"
                          value={minimos[p.id] ?? ""}
                          onChange={(e) =>
                            setMinimos((m) => ({
                              ...m,
                              [p.id]: e.target.value,
                            }))
                          }
                          onBlur={() => guardarMin(p.id)}
                        />
                      ) : (
                        <span className="tabular-nums">{p.minimo}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.variant}>{b.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtMoney(p.ppp)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(p.valorACosto)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Total propio = en depósito + en consignación. El estado y el mínimo se
        evalúan sobre lo disponible en depósito. Las salidas toman del lote más
        viejo (FIFO). Los insumos tienen su stock en el módulo Insumos.
      </p>
    </div>
  );
}
