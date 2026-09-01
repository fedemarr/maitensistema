"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  marcarVendida,
  registrarDevolucion,
} from "@/features/consignaciones/actions";
import type { ConsignacionListItem } from "@/features/consignaciones/queries";
import { fmtDate, fmtNumber } from "@/lib/format";

const SIN_MEDIO = "__none__";

export function ConsignacionesList({
  consignaciones,
  mediosPago,
  editable,
}: {
  consignaciones: ConsignacionListItem[];
  mediosPago: { id: string; nombre: string }[];
  editable: boolean;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [registrarVenta, setRegistrarVenta] = useState(true);
  const [medioPagoId, setMedioPagoId] = useState("");
  const [precioTotal, setPrecioTotal] = useState("");
  const [pending, startTransition] = useTransition();

  function onMarcarVendida(id: string) {
    startTransition(async () => {
      const res = await marcarVendida({
        id,
        registrarVenta,
        medioPagoId: medioPagoId || null,
        precioTotal: precioTotal ? Number(precioTotal) : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(
          registrarVenta ? "Consignación vendida (con venta registrada)." : "Consignación marcada como vendida.",
        );
        setAbierta(null);
      }
    });
  }

  function onDevolucion(id: string) {
    startTransition(async () => {
      const res = await registrarDevolucion({ id });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Devolución registrada: el stock volvió.");
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Productos</TableHead>
            <TableHead className="text-right">Unidades</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead>Estado</TableHead>
            {editable ? <TableHead>Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {consignaciones.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                Todavía no hay consignaciones.
              </TableCell>
            </TableRow>
          ) : (
            consignaciones.map((c) => {
              const items = c.movimiento?.items ?? [];
              const unidades = items.reduce((a, i) => a + i.cantidad, 0);
              const productoNombres = [
                ...new Set(items.map((i) => i.variante.producto.nombre)),
              ].slice(0, 3);
              const pendiente = c.estado === "pendiente";
              const esVencida = c.vencida;

              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/clientes/${c.cliente.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.cliente.nombre}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                    {productoNombres.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNumber(unidades)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {fmtDate(c.fecha)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {fmtDate(c.venceEl)}
                  </TableCell>
                  <TableCell>
                    {c.estado === "pendiente" ? (
                      esVencida ? (
                        <Badge variant="destructive">Vencida</Badge>
                      ) : (
                        <Badge>Pendiente</Badge>
                      )
                    ) : c.estado === "vendido" ? (
                      <Badge variant="secondary">Vendida</Badge>
                    ) : (
                      <Badge variant="outline">Devuelta</Badge>
                    )}
                  </TableCell>
                  {editable ? (
                    <TableCell>
                      {pendiente ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <Button
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            onClick={() =>
                              setAbierta(abierta === c.id ? null : c.id)
                            }
                            disabled={pending}
                          >
                            {abierta === c.id
                              ? "Cerrar"
                              : "Marcar vendida…"}
                          </Button>
                          {abierta === c.id ? (
                            <div className="grid gap-2 rounded-md border bg-muted/40 p-3">
                              <label className="flex w-fit items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={registrarVenta}
                                  onChange={(e) => setRegistrarVenta(e.target.checked)}
                                  className="size-4"
                                />
                                Registrar también la venta
                              </label>
                              {registrarVenta ? (
                                <>
                                  <Select
                                    items={[
                                      { label: "Solo efectivo (sin CC)", value: SIN_MEDIO },
                                      ...mediosPago.map((m) => ({
                                        label: m.nombre,
                                        value: m.id,
                                      })),
                                    ]}
                                    value={medioPagoId || SIN_MEDIO}
                                    onValueChange={(v) =>
                                      setMedioPagoId(!v || v === SIN_MEDIO ? "" : String(v))
                                    }
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {[
                                        { label: "Solo efectivo (sin CC)", value: SIN_MEDIO },
                                        ...mediosPago.map((m) => ({
                                          label: m.nombre,
                                          value: m.id,
                                        })),
                                      ].map((it) => (
                                        <SelectItem key={it.value} value={it.value}>
                                          {it.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <div className="grid gap-1.5">
                                    <Label className="text-xs">Total (si difiere de costo)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={precioTotal}
                                      onChange={(e) => setPrecioTotal(e.target.value)}
                                      placeholder="calcular de la venta"
                                    />
                                  </div>
                                </>
                              ) : null}
                              <Button
                                size="sm"
                                onClick={() => onMarcarVendida(c.id)}
                                disabled={pending}
                              >
                                Confirmar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              className="h-8 px-2 text-xs text-destructive"
                              onClick={() => {
                                if (
                                  confirm(
                                    "¿Registrar la devolución? El stock vuelve a Maitén.",
                                  )
                                ) {
                                  onDevolucion(c.id);
                                }
                              }}
                              disabled={pending}
                            >
                              Devolución
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}