"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  crearCostoFijo,
  darDeBajaCostoFijo,
  nuevaVersionCostoFijo,
} from "@/features/costos-fijos/actions";
import type { CostoFijoRow } from "@/features/costos-fijos/queries";
import {
  CATEGORIAS_COSTO_FIJO,
  CATEGORIA_LABEL,
  type CategoriaCostoFijo,
} from "@/features/costos-fijos/schema";
import { fmtDate, fmtMoney } from "@/lib/format";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export function CostosFijosManager({
  costos,
  editable,
}: {
  costos: CostoFijoRow[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Alta
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<CategoriaCostoFijo>("otros");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Nueva versión / baja
  const [editando, setEditando] = useState<CostoFijoRow | null>(null);
  const [nuevoMonto, setNuevoMonto] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState<CategoriaCostoFijo>("otros");

  function onCrear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await crearCostoFijo({
        concepto,
        categoria,
        montoMensual: Number(monto || 0),
        vigenteDesde: hoy(),
        notas: null,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setConcepto("");
      setMonto("");
      toast.success("Costo fijo cargado.");
      router.refresh();
    });
  }

  function abrirEdicion(c: CostoFijoRow) {
    setEditando(c);
    setNuevoMonto(String(Number(c.montoMensual)));
    setNuevaCategoria(c.categoria);
  }

  function onGuardarVersion() {
    if (!editando) return;
    startTransition(async () => {
      const res = await nuevaVersionCostoFijo({
        costoFijoId: editando.id,
        montoMensual: Number(nuevoMonto || 0),
        categoria: nuevaCategoria,
        vigenteDesde: hoy(),
        notas: null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Nueva versión guardada.");
      setEditando(null);
      router.refresh();
    });
  }

  function onDarDeBaja(c: CostoFijoRow) {
    startTransition(async () => {
      const res = await darDeBajaCostoFijo(c.id, hoy());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Costo fijo dado de baja.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {editable ? (
        <form
          onSubmit={onCrear}
          className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_9rem_8rem_auto]"
        >
          <Input
            placeholder="Concepto (ej: Alquiler del taller)"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
          />
          <Select
            items={CATEGORIAS_COSTO_FIJO.map((c) => ({
              label: CATEGORIA_LABEL[c],
              value: c,
            }))}
            value={categoria}
            onValueChange={(v) => setCategoria((v as CategoriaCostoFijo) ?? "otros")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS_COSTO_FIJO.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            step="any"
            placeholder="$ mensual"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <Button type="submit" disabled={pending || !concepto.trim()}>
            {pending ? "Guardando…" : "Agregar"}
          </Button>
        </form>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">$ mensual</TableHead>
              <TableHead>Vigencia</TableHead>
              {editable ? <TableHead>Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {costos.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={editable ? 5 : 4}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Todavía no hay costos fijos cargados.
                </TableCell>
              </TableRow>
            ) : (
              costos.map((c) => {
                const vigente = !c.vigenteHasta;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.concepto}</TableCell>
                    <TableCell>{CATEGORIA_LABEL[c.categoria]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(c.montoMensual)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(c.vigenteDesde)}
                      {c.vigenteHasta ? ` → ${fmtDate(c.vigenteHasta)}` : ""}{" "}
                      {vigente ? (
                        <Badge variant="secondary" className="ml-1">
                          Vigente
                        </Badge>
                      ) : null}
                    </TableCell>
                    {editable ? (
                      <TableCell className="space-x-2">
                        {vigente ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirEdicion(c)}
                            >
                              Nueva versión
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={pending}
                              onClick={() => onDarDeBaja(c)}
                            >
                              Dar de baja
                            </Button>
                          </>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva versión — {editando?.concepto}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select
                items={CATEGORIAS_COSTO_FIJO.map((c) => ({
                  label: CATEGORIA_LABEL[c],
                  value: c,
                }))}
                value={nuevaCategoria}
                onValueChange={(v) =>
                  setNuevaCategoria((v as CategoriaCostoFijo) ?? "otros")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_COSTO_FIJO.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORIA_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Nuevo monto mensual</Label>
              <Input
                type="number"
                step="any"
                value={nuevoMonto}
                onChange={(e) => setNuevoMonto(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              La versión actual queda vigente hasta ayer; esta rige desde hoy (
              {fmtDate(hoy())}).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={onGuardarVersion} disabled={pending}>
              {pending ? "Guardando…" : "Guardar nueva versión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
