"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { registrarPago } from "@/features/cc/actions";
import type { CcMovimientoRow } from "@/features/cc/queries";
import { MEDIOS_PAGO_CC, ORIGEN_CC_LABEL } from "@/features/cc/schema";
import { MEDIO_PAGO_LABEL } from "@/features/movimientos/schema";
import { fmtDate, fmtMoney } from "@/lib/format";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export function CcProveedor({
  proveedorId,
  saldo,
  historial,
  compras,
  editable,
}: {
  proveedorId: string;
  saldo: number;
  historial: CcMovimientoRow[];
  compras: { id: string; fecha: string; total: string; medioPago: string; lote: string | null }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] =
    useState<(typeof MEDIOS_PAGO_CC)[number]>("efectivo");
  const [concepto, setConcepto] = useState("");
  const [pending, startTransition] = useTransition();

  function onPagar() {
    startTransition(async () => {
      const res = await registrarPago({
        proveedorId,
        fecha: hoy(),
        monto: Number(monto || 0),
        medioPago,
        concepto: concepto || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Pago registrado.");
      setOpen(false);
      setMonto("");
      setConcepto("");
      router.refresh();
    });
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Cuenta corriente</CardTitle>
          {editable ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              Registrar pago
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums">
              {fmtMoney(Math.abs(saldo))}
            </span>
            {saldo > 0 ? (
              <Badge variant="destructive">Le debemos</Badge>
            ) : saldo < 0 ? (
              <Badge variant="secondary">A nuestro favor</Badge>
            ) : (
              <Badge variant="outline">Sin saldo</Badge>
            )}
          </div>

          {historial.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead className="text-right">Debe</TableHead>
                    <TableHead className="text-right">Haber</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{fmtDate(h.fecha)}</TableCell>
                      <TableCell className="font-medium">
                        {h.concepto}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ORIGEN_CC_LABEL[h.origen]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(h.debe) ? fmtMoney(h.debe) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(h.haber) ? fmtMoney(h.haber) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin movimientos de cuenta corriente.
            </p>
          )}
        </CardContent>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar pago</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Monto *</Label>
                <Input
                  type="number"
                  step="any"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Medio de pago *</Label>
                <Select
                  items={MEDIOS_PAGO_CC.map((m) => ({
                    label: MEDIO_PAGO_LABEL[m],
                    value: m,
                  }))}
                  value={medioPago}
                  onValueChange={(v) =>
                    setMedioPago(
                      (v as (typeof MEDIOS_PAGO_CC)[number]) ?? "efectivo",
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIOS_PAGO_CC.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MEDIO_PAGO_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Concepto (opcional)</Label>
                <Input
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                  placeholder="Pago"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={onPagar} disabled={pending || !monto}>
                {pending ? "Guardando…" : "Registrar pago"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>

      {compras.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compras al proveedor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Medio de pago</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{fmtDate(c.fecha)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.lote ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {MEDIO_PAGO_LABEL[
                          c.medioPago as keyof typeof MEDIO_PAGO_LABEL
                        ] ?? c.medioPago}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(c.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
