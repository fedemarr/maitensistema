"use client";

import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  anularOrden,
  cerrarOrden,
  getOrdenCierre,
} from "@/features/produccion/actions";
import type {
  OrdenListItem,
  OrdenParaCerrar,
} from "@/features/produccion/queries";
import { ESTADO_LABEL } from "@/features/produccion/schema";
import { fmtCantidad, fmtDate, fmtMoney, fmtNumber } from "@/lib/format";

export function OrdenesTabla({
  ordenes,
  esAdmin,
  editable,
}: {
  ordenes: OrdenListItem[];
  esAdmin: boolean;
  editable: boolean;
}) {
  const [cierre, setCierre] = useState<OrdenParaCerrar | null>(null);
  const [obt, setObt] = useState("");
  const [fabReal, setFabReal] = useState("");
  const [reales, setReales] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function abrirCierre(id: string) {
    const o = await getOrdenCierre(id);
    if (!o) {
      toast.error("No pude cargar la orden.");
      return;
    }
    setCierre(o);
    setObt(String(o.unidadesPlanificadas));
    setFabReal(String(Number(o.fabricacionCotizada)));
    setReales(
      Object.fromEntries(
        o.lineas.map((l) => [
          l.insumoId,
          l.unidad === "kg"
            ? l.consumoTeorico.toFixed(3)
            : String(l.consumoTeorico),
        ]),
      ),
    );
  }

  const calc = () => {
    if (!cierre) return null;
    const o = Math.max(1, Number(obt) || 1);
    let mp = 0;
    let desvMp = 0;
    for (const l of cierre.lineas) {
      const real = Number(reales[l.insumoId] ?? 0);
      mp += real * l.ppp;
      desvMp += (real - l.consumoTeorico) * l.ppp;
    }
    const fab = Number(fabReal) || 0;
    const total = mp + fab;
    return {
      mp,
      fab,
      total,
      unit: total / o,
      rend: o / cierre.unidadesPlanificadas,
      desvMp,
      desvFab: fab - Number(cierre.fabricacionCotizada),
    };
  };
  const c = calc();

  async function confirmar() {
    if (!cierre) return;
    setBusy(true);
    const res = await cerrarOrden({
      ordenId: cierre.id,
      unidadesObtenidas: Number(obt || 0),
      fabricacionCobrada: Number(fabReal || 0),
      consumos: cierre.lineas.map((l) => ({
        insumoId: l.insumoId,
        consumoReal: Number(reales[l.insumoId] ?? 0),
      })),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Orden cerrada · stock generado.");
    setCierre(null);
    location.reload();
  }

  async function anular(id: string) {
    setBusy(true);
    const res = await anularOrden(id);
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Orden anulada.");
      location.reload();
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Planif.</TableHead>
              <TableHead className="text-right">Obten.</TableHead>
              <TableHead className="text-right">Rend.</TableHead>
              <TableHead className="text-right">Fábrica / u</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Costo unit.</TableHead>
              <TableHead className="text-right">Desvío MP</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin órdenes.
                </TableCell>
              </TableRow>
            ) : (
              ordenes.map((o) => {
                const cerrada = o.estado === "cerrada";
                return (
                  <TableRow key={o.id}>
                    <TableCell>{fmtDate(o.fecha)}</TableCell>
                    <TableCell className="font-medium">{o.producto}</TableCell>
                    <TableCell className="font-mono text-xs">{o.lote}</TableCell>
                    <TableCell>
                      <Badge
                        variant={cerrada ? "secondary" : "outline"}
                        className={
                          o.estado === "anulada" ? "text-muted-foreground" : ""
                        }
                      >
                        {ESTADO_LABEL[o.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNumber(o.planificadas)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.obtenidas != null ? fmtNumber(o.obtenidas) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.rendimiento != null
                        ? `${(o.rendimiento * 100).toFixed(1)} %`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {Number(o.precioFabricacion) > 0
                        ? fmtMoney(o.precioFabricacion)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {Number(o.minimoAplicado) > 0
                        ? fmtMoney(o.minimoAplicado)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.costoUnitario ? fmtMoney(o.costoUnitario) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cerrada && Math.abs(Number(o.desvioMp)) >= 0.5 ? (
                        <span
                          className={
                            Number(o.desvioMp) > 0
                              ? "text-destructive"
                              : "text-[var(--color-chart-1)]"
                          }
                        >
                          {Number(o.desvioMp) > 0 ? "+" : ""}
                          {fmtMoney(o.desvioMp)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {o.estado === "planificada" && editable ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => abrirCierre(o.id)}
                            disabled={busy}
                          >
                            Cerrar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => anular(o.id)}
                            disabled={busy}
                          >
                            Anular
                          </Button>
                        </div>
                      ) : cerrada && esAdmin ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => anular(o.id)}
                          disabled={busy}
                        >
                          Anular
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={cierre !== null} onOpenChange={(v) => !v && setCierre(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {cierre
                ? `Cerrar orden — ${cierre.productoNombre} · ${cierre.loteNombre}`
                : "Cerrar orden"}
            </DialogTitle>
          </DialogHeader>
          {cierre ? (
            <div className="space-y-4">
              <div className="max-h-[40vh] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-right">Teórico</TableHead>
                      <TableHead className="text-right">Real</TableHead>
                      <TableHead className="text-right">Desvío $</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cierre.lineas.map((l) => {
                      const real = Number(reales[l.insumoId] ?? 0);
                      const du = (real - l.consumoTeorico) * l.ppp;
                      return (
                        <TableRow key={l.insumoId}>
                          <TableCell className="font-medium">
                            {l.nombre}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {fmtCantidad(l.consumoTeorico, l.unidad)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              className="ml-auto h-8 w-24 text-right"
                              value={reales[l.insumoId] ?? ""}
                              onChange={(e) =>
                                setReales((r) => ({
                                  ...r,
                                  [l.insumoId]: e.target.value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Math.abs(du) < 0.5 ? (
                              "—"
                            ) : (
                              <span
                                className={
                                  du > 0
                                    ? "text-destructive"
                                    : "text-[var(--color-chart-1)]"
                                }
                              >
                                {du > 0 ? "+" : "−"}
                                {fmtMoney(Math.abs(du))}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">
                    Unidades obtenidas *{" "}
                    <span className="text-muted-foreground">
                      (planif. {cierre.unidadesPlanificadas})
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={obt}
                    onChange={(e) => setObt(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">
                    Fabricación cobrada ($ sin IVA) *
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={fabReal}
                    onChange={(e) => setFabReal(e.target.value)}
                  />
                </div>
              </div>

              {c ? (
                <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">MP:</span>{" "}
                    <b>{fmtMoney(c.mp)}</b>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>{" "}
                    <b>{fmtMoney(c.total)}</b>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Costo unit.:</span>{" "}
                    <b>{fmtMoney(c.unit)}</b>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rendimiento:</span>{" "}
                    <b
                      className={
                        c.rend < 0.97 ? "text-destructive" : undefined
                      }
                    >
                      {(c.rend * 100).toFixed(1)} %
                    </b>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCierre(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={busy}>
              {busy ? "Cerrando…" : "Cerrar orden y dar entrada al stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
