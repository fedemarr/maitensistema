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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtMoney } from "@/lib/format";
import { emitirNotaCredito, previsualizarNotaCredito } from "../actions";

/** Confirmación antes de emitir una NC real (adenda v1.3 §3 + §9.1). */
export function NotaCreditoDialog({
  movimientoId,
  trigger,
  onEmitida,
}: {
  movimientoId: string;
  trigger: React.ReactNode;
  onEmitida?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [modalidad, setModalidad] = useState<"total" | "parcial">("total");
  const [importe, setImporte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [devolucionFisica, setDevolucionFisica] = useState(false);
  const [pre, setPre] = useState<{ tipoComprobante: string; saldo: number; importe: number; importeNeto: number; importeIva: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, startCarga] = useTransition();
  const [emitiendo, startEmitir] = useTransition();

  function recalcular(nuevaModalidad = modalidad, nuevoImporte = importe) {
    setError(null);
    startCarga(async () => {
      const res = await previsualizarNotaCredito(movimientoId, {
        modalidad: nuevaModalidad,
        importe: nuevaModalidad === "parcial" ? Number(nuevoImporte || 0) : undefined,
      });
      if ("error" in res) {
        setPre(null);
        setError(res.error);
      } else {
        setPre(res);
      }
    });
  }

  function abrir() {
    setOpen(true);
    setModalidad("total");
    setImporte("");
    setMotivo("");
    setDevolucionFisica(false);
    recalcular("total", "");
  }

  function confirmar() {
    if (!motivo.trim()) {
      toast.error("Indicá el motivo de la nota de crédito.");
      return;
    }
    startEmitir(async () => {
      const res = await emitirNotaCredito(movimientoId, {
        modalidad,
        importe: modalidad === "parcial" ? Number(importe || 0) : undefined,
        motivo,
        devolucionFisica,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.tipoComprobante} N.º ${res.numero} — CAE ${res.cae}`);
      setOpen(false);
      onEmitida?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? abrir() : setOpen(o))}>
      <div onClick={abrir}>{trigger}</div>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Emitir nota de crédito</DialogTitle>
          <DialogDescription>
            Corrige la factura emitida — pide un CAE real a AFIP, es irreversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid gap-1.5">
            <Label className="text-xs">Modalidad</Label>
            <Select
              items={[
                { label: "Total (anula el movimiento)", value: "total" },
                { label: "Parcial (solo el importe)", value: "parcial" },
              ]}
              value={modalidad}
              onValueChange={(v) => {
                const nueva = (v as "total" | "parcial") ?? "total";
                setModalidad(nueva);
                recalcular(nueva, importe);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total (anula el movimiento)</SelectItem>
                <SelectItem value="parcial">Parcial (solo el importe)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modalidad === "parcial" ? (
            <div className="grid gap-1.5">
              <Label className="text-xs">Importe a notar (con IVA) *</Label>
              <Input
                type="number"
                step="any"
                value={importe}
                onChange={(e) => {
                  setImporte(e.target.value);
                  recalcular("parcial", e.target.value);
                }}
              />
            </div>
          ) : null}

          {modalidad === "total" ? (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={devolucionFisica}
                onChange={(e) => setDevolucionFisica(e.target.checked)}
              />
              Hubo devolución física del producto (vuelve el stock)
            </label>
          ) : null}

          <div className="grid gap-1.5">
            <Label className="text-xs">Motivo *</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>

          {cargando ? (
            <p className="text-xs text-muted-foreground">Calculando…</p>
          ) : error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : pre ? (
            <div className="space-y-0.5 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Saldo de la factura</span>
                <span className="tabular-nums">{fmtMoney(pre.saldo)}</span>
              </div>
              <div className="flex justify-between font-medium text-foreground">
                <span>{pre.tipoComprobante} por</span>
                <span className="tabular-nums">{fmtMoney(pre.importe)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={emitiendo}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!pre || emitiendo || cargando}>
            {emitiendo ? "Emitiendo…" : "Emitir nota de crédito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
