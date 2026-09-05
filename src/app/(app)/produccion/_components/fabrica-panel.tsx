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
import {
  agregarVigenciaMinimo,
  agregarVigenciaPrecioFab,
} from "@/features/produccion/actions";
import { fmtDate, fmtMoney } from "@/lib/format";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)} %`);

type Producto = { id: string; nombre: string };
type PrecioFila = {
  id: string;
  producto: string | null;
  monto: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
};
type MinimoFila = {
  id: string;
  monto: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  variacion: number | null;
  ordenes: number;
};

export function FabricaPanel({
  productos,
  precios,
  minimos,
  editable,
}: {
  productos: Producto[];
  precios: PrecioFila[];
  minimos: MinimoFila[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Alta de vigencia de precio
  const [pProd, setPProd] = useState(productos[0]?.id ?? "");
  const [pMonto, setPMonto] = useState("");
  const [pDesde, setPDesde] = useState(hoy());

  // Alta de vigencia de mínimo
  const [mMonto, setMMonto] = useState("");
  const [mDesde, setMDesde] = useState(hoy());

  function nuevaPrecio() {
    startTransition(async () => {
      const res = await agregarVigenciaPrecioFab({
        productoId: pProd,
        precioUnitario: Number(pMonto || 0),
        vigenteDesde: pDesde,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Vigencia agregada.");
      setPMonto("");
      router.refresh();
    });
  }

  function nuevoMinimo() {
    startTransition(async () => {
      const res = await agregarVigenciaMinimo({
        monto: Number(mMonto || 0),
        vigenteDesde: mDesde,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Vigencia agregada.");
      setMMonto("");
      router.refresh();
    });
  }

  const vigentesPorProducto = new Map<string, PrecioFila>();
  for (const p of precios) {
    if (!p.vigenteHasta) vigentesPorProducto.set(p.producto ?? "", p);
  }
  const minimoVigente = minimos.find((m) => !m.vigenteHasta) ?? minimos.at(-1);

  const estadoDe = (f: { vigenteDesde: string; vigenteHasta: string | null }) => {
    const h = hoy();
    if (f.vigenteDesde > h) return "Futura";
    if (!f.vigenteHasta || f.vigenteHasta >= h) return "Vigente";
    return "Cerrada";
  };

  return (
    <div className="space-y-6">
      {/* ── Precio de fabricación por producto ─────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Precio de fabricación por producto ($ sin IVA)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            La orden toma el precio vigente a su fecha y lo congela. Cargar un
            precio nuevo no pisa el anterior: agrega una vigencia.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {productos.map((p) => {
              const v = vigentesPorProducto.get(p.nombre);
              return (
                <div key={p.id} className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{p.nombre}</p>
                  <p className="font-semibold tabular-nums">
                    {v ? `${fmtMoney(v.monto)} / u` : "sin precio"}
                  </p>
                  {v ? (
                    <p className="text-[11px] text-muted-foreground">
                      desde {fmtDate(v.vigenteDesde)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {editable ? (
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_9rem_10rem_auto]">
              <Select
                items={productos.map((p) => ({ label: p.nombre, value: p.id }))}
                value={pProd}
                onValueChange={(v) => setPProd(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="any"
                placeholder="$ / u sin IVA"
                value={pMonto}
                onChange={(e) => setPMonto(e.target.value)}
              />
              <Input
                type="date"
                value={pDesde}
                onChange={(e) => setPDesde(e.target.value)}
              />
              <Button
                type="button"
                disabled={pending || !pMonto || !pProd}
                onClick={nuevaPrecio}
              >
                Agregar vigencia
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Hasta</TableHead>
                  <TableHead className="text-right">Precio / u</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {precios.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Sin precios cargados.
                    </TableCell>
                  </TableRow>
                ) : (
                  precios.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.producto}</TableCell>
                      <TableCell>{fmtDate(f.vigenteDesde)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.vigenteHasta ? fmtDate(f.vigenteHasta) : "en curso"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(f.monto)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            estadoDe(f) === "Vigente" ? "secondary" : "outline"
                          }
                        >
                          {estadoDe(f)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Mínimo de compra por orden ─────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Mínimo de compra por orden ($ sin IVA)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Se controla sobre el total del lote (todas sus órdenes, planificadas
            + cerradas) contra el mínimo vigente a la fecha de la orden. Cada
            orden congela el mínimo con el que se controló.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Vigente</p>
            <p className="font-semibold tabular-nums">
              {minimoVigente ? fmtMoney(minimoVigente.monto) : "—"}
              {minimoVigente ? (
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  desde {fmtDate(minimoVigente.vigenteDesde)}
                </span>
              ) : null}
            </p>
          </div>

          {editable ? (
            <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[10rem_10rem_auto]">
              <Input
                type="number"
                step="any"
                placeholder="nuevo mínimo"
                value={mMonto}
                onChange={(e) => setMMonto(e.target.value)}
              />
              <Input
                type="date"
                value={mDesde}
                onChange={(e) => setMDesde(e.target.value)}
              />
              <Button
                type="button"
                disabled={pending || !mMonto}
                onClick={nuevoMinimo}
              >
                Agregar vigencia
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Desde</TableHead>
                  <TableHead>Hasta</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Variación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Órdenes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {minimos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Sin mínimos cargados.
                    </TableCell>
                  </TableRow>
                ) : (
                  minimos.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{fmtDate(f.vigenteDesde)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.vigenteHasta ? fmtDate(f.vigenteHasta) : "en curso"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(f.monto)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(f.variacion)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            estadoDe(f) === "Vigente" ? "secondary" : "outline"
                          }
                        >
                          {estadoDe(f)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.ordenes}
                      </TableCell>
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
