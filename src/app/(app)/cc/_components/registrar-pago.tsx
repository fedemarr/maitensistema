"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { registrarPago } from "@/features/cc/actions";
import type { EntidadTipo } from "@/features/cc/queries";

const SIN_MEDIO = "__none__";

export function RegistrarPagoForm({
  entidadTipo,
  entidadId,
  mediosPago,
}: {
  entidadTipo: EntidadTipo;
  entidadId: string;
  mediosPago: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [medioPagoId, setMedioPagoId] = useState("");
  const [concepto, setConcepto] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await registrarPago({
        entidadTipo,
        entidadId,
        monto: Number(monto),
        fecha,
        medioPagoId,
        concepto,
      });
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Pago registrado.");
        setMonto("");
        setConcepto("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="grid gap-1.5">
        <Label className="text-xs">Monto</Label>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          required
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Fecha</Label>
        <Input
          type="date"
          required
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Medio de pago</Label>
        <Select
          items={[
            { label: "Sin especificar", value: SIN_MEDIO },
            ...mediosPago.map((m) => ({ label: m.nombre, value: m.id })),
          ]}
          value={medioPagoId || SIN_MEDIO}
          onValueChange={(v) =>
            setMedioPagoId(!v || v === SIN_MEDIO ? "" : String(v))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              { label: "Sin especificar", value: SIN_MEDIO },
              ...mediosPago.map((m) => ({ label: m.nombre, value: m.id })),
            ].map((it) => (
              <SelectItem key={it.value} value={it.value}>
                {it.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label className="text-xs">Concepto</Label>
        <Input
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="opcional"
        />
      </div>
      <Button type="submit" disabled={pending} className="sm:col-span-2 lg:col-span-1">
        {pending ? "Guardando…" : "Registrar pago"}
      </Button>
    </form>
  );
}