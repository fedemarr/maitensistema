"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { planificarOrden } from "@/features/produccion/actions";
import type { LineaPlan } from "@/features/produccion/queries";
import { fmtCantidad, fmtDate, fmtMoney } from "@/lib/format";

type Terminado = { id: string; nombre: string };
type Lote = { id: string; nombre: string };
type Vigencia = { monto: number; vigenteDesde: string; vigenteHasta: string | null };

const hoy = () => new Date().toISOString().slice(0, 10);
const NUEVO_LOTE = "__new";
const SIN_LINEAS: LineaPlan[] = [];

/** Última vigencia cuya fecha de inicio es <= `fecha`. */
function vigenteEn(vigencias: Vigencia[], fecha: string): Vigencia | null {
  const ordenadas = [...vigencias].sort((a, b) =>
    a.vigenteDesde.localeCompare(b.vigenteDesde),
  );
  let elegida: Vigencia | null = null;
  for (const v of ordenadas) {
    if (v.vigenteDesde <= fecha) elegida = v;
  }
  return elegida ?? ordenadas[0] ?? null;
}

export function PlanificarForm({
  terminados,
  lotes,
  recetas,
  preciosFab,
  minimos,
  fabPorLote,
}: {
  terminados: Terminado[];
  lotes: Lote[];
  recetas: Record<string, LineaPlan[]>;
  /** Historial de precio de fabricación por producto (sin IVA). */
  preciosFab: Record<string, Vigencia[]>;
  /** Historial del mínimo de compra de la fábrica. */
  minimos: Vigencia[];
  /** Fabricación cotizada ya acumulada por lote (planificadas + cerradas). */
  fabPorLote: Record<string, number>;
}) {
  const router = useRouter();
  const [productoId, setProductoId] = useState(terminados[0]?.id ?? "");
  const [loteSel, setLoteSel] = useState(lotes[lotes.length - 1]?.id ?? "");
  const [nuevoLote, setNuevoLote] = useState("");
  const [cantidad, setCantidad] = useState("400");
  const [fecha, setFecha] = useState(hoy());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineas = recetas[productoId] ?? SIN_LINEAS;
  const cant = Math.max(1, Number(cantidad) || 1);

  const precioFab = vigenteEn(preciosFab[productoId] ?? [], fecha);
  const minimo = vigenteEn(minimos, fecha);
  const precioUnit = precioFab?.monto ?? 0;
  const cotizada = precioUnit * cant;

  const totalLote = (fabPorLote[loteSel] ?? 0) + cotizada;
  const minMonto = minimo?.monto ?? 0;
  const llegaAlMinimo = totalLote + 1e-6 >= minMonto;
  const faltaMinimo = Math.max(0, minMonto - totalLote);

  const plan = useMemo(() => {
    const filas = lineas.map((l) => {
      const teorico = l.cantidadPorUnidad * cant;
      return { ...l, teorico, alcanza: l.stock + 1e-9 >= teorico };
    });
    return {
      filas,
      cubiertos: filas.filter((f) => f.alcanza).length,
      faltantes: filas.filter((f) => !f.alcanza).length,
      costoMp: filas.reduce((a, f) => a + f.teorico * f.ppp, 0),
    };
  }, [lineas, cant]);

  const costoTotal = plan.costoMp + cotizada;

  async function crear() {
    if (loteSel === NUEVO_LOTE && !nuevoLote.trim()) {
      toast.error("Poné el nombre del lote nuevo.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await planificarOrden({
      productoId,
      loteId: loteSel === NUEVO_LOTE ? "" : loteSel,
      nuevoLoteNombre: loteSel === NUEVO_LOTE ? nuevoLote : "",
      cantidad: cant,
      fechaPrevista: fecha,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Orden planificada. Cuando terminen de fabricar, cerrala.");
    router.refresh();
  }

  if (terminados.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No hay productos con receta vigente. Cargá una receta desde la ficha de
          un producto terminado.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Nueva orden de producción — planificar
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Una orden planificada es una intención: todavía no mueve stock.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Producto *</Label>
            <Select
              items={terminados.map((t) => ({ label: t.nombre, value: t.id }))}
              value={productoId}
              onValueChange={(v) => setProductoId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {terminados.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Lote *</Label>
            <Select
              items={[
                ...lotes.map((l) => ({ label: l.nombre, value: l.id })),
                { label: "＋ Crear lote nuevo…", value: NUEVO_LOTE },
              ]}
              value={loteSel}
              onValueChange={(v) => setLoteSel(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí un lote" />
              </SelectTrigger>
              <SelectContent>
                {lotes.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nombre}
                  </SelectItem>
                ))}
                <SelectItem value={NUEVO_LOTE}>＋ Crear lote nuevo…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Cantidad a fabricar *</Label>
            <Input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Fecha prevista *</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>

        {loteSel === NUEVO_LOTE ? (
          <div className="grid max-w-xs gap-1.5">
            <Label className="text-xs">Nombre del lote nuevo *</Label>
            <Input
              value={nuevoLote}
              onChange={(e) => setNuevoLote(e.target.value)}
              placeholder="Lote N.º 3"
            />
          </div>
        ) : null}

        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Precio de fabricación por unidad ($ sin IVA)
          </p>
          {precioFab ? (
            <p className="mt-1">
              <b className="tabular-nums">{fmtMoney(precioUnit)}</b> / u ·
              cotizada de este lote:{" "}
              <b className="tabular-nums">{fmtMoney(cotizada)}</b>{" "}
              <span className="text-xs text-muted-foreground">
                ({cant} u × {fmtMoney(precioUnit)})
              </span>
              <br />
              <span className="text-xs text-muted-foreground">
                Tomado del tarifario, vigente desde{" "}
                {fmtDate(precioFab.vigenteDesde)}. ¿Aumentó la fábrica?{" "}
                <Link
                  href="/produccion/fabrica"
                  className="underline underline-offset-2"
                >
                  cargalo en Fábrica
                </Link>
                .
              </span>
            </p>
          ) : (
            <p className="mt-1 text-destructive">
              Este producto no tiene precio de fabricación cargado.{" "}
              <Link href="/produccion/fabrica" className="underline">
                Cargalo en Fábrica
              </Link>
              .
            </p>
          )}
          <p className="mt-2 text-xs">
            {llegaAlMinimo ? (
              <span className="text-[var(--color-chart-1)]">
                ✔ Supera el mínimo de compra del lote: total{" "}
                {fmtMoney(totalLote)} (mínimo {fmtMoney(minMonto)}).
              </span>
            ) : (
              <span className="font-medium text-destructive">
                ⚠ No llega al mínimo de compra: faltan {fmtMoney(faltaMinimo)}.
                Se paga el mínimo igual — agregá unidades o sumá el otro producto
                a este lote.
              </span>
            )}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="text-right">Estándar / u</TableHead>
                <TableHead className="text-right">Consumo teórico</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead>¿Alcanza?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.filas.map((f) => (
                <TableRow key={f.insumoId}>
                  <TableCell className="font-medium">{f.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmtCantidad(f.cantidadPorUnidad, f.unidad)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtCantidad(f.teorico, f.unidad)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtCantidad(f.stock, f.unidad)}
                  </TableCell>
                  <TableCell>
                    {f.alcanza ? (
                      <span className="text-sm text-[var(--color-chart-1)]">
                        Alcanza
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-destructive">
                        Faltan {fmtCantidad(f.teorico - f.stock, f.unidad)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {plan.filas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-4 text-center text-sm text-muted-foreground"
                  >
                    Este producto no tiene receta vigente.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">
              Insumos cubiertos
            </p>
            <p className="text-lg font-bold">{plan.cubiertos}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">
              Insumos faltantes
            </p>
            <p
              className={`text-lg font-bold ${
                plan.faltantes ? "text-destructive" : ""
              }`}
            >
              {plan.faltantes}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">
              Costo estándar estimado
            </p>
            <p className="text-lg font-bold">
              {fmtMoney(costoTotal)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · {fmtMoney(costoTotal / cant)}/u
              </span>
            </p>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          {plan.faltantes > 0 ? (
            <Button variant="outline" render={<Link href="/insumos/compra" />}>
              Comprar lo que falta →
            </Button>
          ) : null}
          <Button
            onClick={crear}
            disabled={saving || plan.filas.length === 0 || !precioFab}
          >
            {saving ? "Creando…" : "Crear orden planificada"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
