"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtMoney } from "@/lib/format";
import { facturarMovimiento, previsualizarFactura, type PrevisualizacionFactura } from "../actions";

/**
 * Confirmación antes de emitir una factura real (adenda v1.3 §9.1): muestra
 * tipo, cliente, ítems y totales antes de pedir el CAE — es irreversible.
 */
export function FacturarDialog({
  movimientoId,
  trigger,
  onEmitida,
}: {
  movimientoId: string;
  trigger: React.ReactNode;
  onEmitida?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [cargando, startCarga] = useTransition();
  const [emitiendo, startEmitir] = useTransition();
  const [pre, setPre] = useState<PrevisualizacionFactura | null>(null);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setOpen(true);
    setPre(null);
    setError(null);
    startCarga(async () => {
      const res = await previsualizarFactura(movimientoId);
      if ("error" in res) setError(res.error);
      else setPre(res);
    });
  }

  function confirmar() {
    startEmitir(async () => {
      const res = await facturarMovimiento(movimientoId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const base = `Factura ${res.tipoComprobante} N.º ${res.numero} — CAE ${res.cae}`;
      if (res.enviada) toast.success(`${base} · enviada por mail`);
      else toast.warning(`${base} · no se pudo enviar: ${res.envioError ?? "sin motivo"}`);
      setOpen(false);
      onEmitida?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? abrir() : setOpen(o))}>
      <div onClick={abrir}>{trigger}</div>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Emitir factura</DialogTitle>
          <DialogDescription>
            Esto pide un CAE real a AFIP — es irreversible. Revisá antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : pre ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="font-medium">Factura {pre.tipoComprobante}</span>
              <span className="text-muted-foreground">{pre.clienteNombre ?? "Consumidor Final"}</span>
            </div>
            <p className="text-xs text-muted-foreground">{pre.clienteDoc}</p>
            <ul className="space-y-1 rounded-md border p-2">
              {pre.items.map((it, i) => (
                <li key={i} className="flex justify-between text-xs">
                  <span>
                    {it.cantidad}× {it.producto}
                  </span>
                  <span className="tabular-nums">{fmtMoney(it.cantidad * it.precioNeto)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Neto</span>
                <span className="tabular-nums">{fmtMoney(pre.importeNeto)}</span>
              </div>
              <div className="flex justify-between">
                <span>IVA 21%</span>
                <span className="tabular-nums">{fmtMoney(pre.importeIva)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(pre.importeTotal)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Se va a enviar a: <b>{pre.clienteEmail ?? "— sin mail cargado —"}</b>
            </p>
            {pre.advertencias.map((a, i) => (
              <p key={i} className="text-xs text-destructive">
                ⚠ {a}
              </p>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={emitiendo}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={!pre || !pre.puedeEmitir || emitiendo || cargando}
          >
            {emitiendo ? "Emitiendo…" : "Emitir factura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
