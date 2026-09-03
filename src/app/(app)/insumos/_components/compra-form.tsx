"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { registrarCompra } from "@/features/insumos/actions";
import type { InsumoCompraRow } from "@/features/insumos/queries";
import { fmtCantidad, fmtMoney } from "@/lib/format";

type Terminado = { id: string; nombre: string };
type Lote = { id: string; nombre: string };
type RecetaMap = Record<string, { insumoId: string; cantidadPorUnidad: number }[]>;

const hoy = () => new Date().toISOString().slice(0, 10);
const NUEVO_LOTE = "__new";
const SIN_PROV = "__none__";
const STOCK_GRAL = "__gral__";

export function CompraForm({
  insumos,
  terminados,
  lotes,
  proveedores,
  recetas,
}: {
  insumos: InsumoCompraRow[];
  terminados: Terminado[];
  lotes: Lote[];
  proveedores: { id: string; nombre: string }[];
  recetas: RecetaMap;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState(hoy());
  const [proveedorId, setProveedorId] = useState("");
  const [loteSel, setLoteSel] = useState(STOCK_GRAL);
  const [nuevoLote, setNuevoLote] = useState("");
  const [prodSug, setProdSug] = useState("");
  const [cantSug, setCantSug] = useState("400");
  const [rows, setRows] = useState<
    Record<string, { cantidad: string; costoTotal: string; vencimiento: string }>
  >({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pppById = useMemo(
    () => new Map(insumos.map((i) => [i.id, Number(i.ppp)])),
    [insumos],
  );
  const stockById = useMemo(
    () => new Map(insumos.map((i) => [i.id, Number(i.stock)])),
    [insumos],
  );

  function setRow(
    id: string,
    patch: Partial<{ cantidad: string; costoTotal: string; vencimiento: string }>,
  ) {
    setRows((r) => {
      const prev = r[id] ?? { cantidad: "", costoTotal: "", vencimiento: "" };
      return { ...r, [id]: { ...prev, ...patch } };
    });
  }

  function sugerir() {
    if (!prodSug) {
      toast.error("Elegí el producto para precargar.");
      return;
    }
    const cant = Math.max(1, Number(cantSug) || 1);
    const receta = recetas[prodSug] ?? [];
    const next: typeof rows = {};
    for (const linea of receta) {
      const stock = stockById.get(linea.insumoId) ?? 0;
      const nec = Math.max(0, linea.cantidadPorUnidad * cant - stock);
      if (nec <= 0) continue;
      const unidad = insumos.find((i) => i.id === linea.insumoId)?.unidad ?? "kg";
      const q = unidad === "kg" ? Number(nec.toFixed(3)) : Math.ceil(nec);
      next[linea.insumoId] = {
        cantidad: String(q),
        costoTotal: String(Math.round(q * (pppById.get(linea.insumoId) ?? 0))),
        vencimiento: "",
      };
    }
    setRows(next);
    toast.success("Cantidades sugeridas desde la receta (neto de stock).");
  }

  const lineasConCompra = Object.entries(rows).filter(
    ([, r]) => Number(r.cantidad) > 0,
  );
  const totalCompra = lineasConCompra.reduce(
    (a, [, r]) => a + (Number(r.costoTotal) || 0),
    0,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await registrarCompra({
      fecha,
      proveedorId: proveedorId || "",
      loteId: loteSel === STOCK_GRAL || loteSel === NUEVO_LOTE ? "" : loteSel,
      nuevoLoteNombre: loteSel === NUEVO_LOTE ? nuevoLote : "",
      lineas: lineasConCompra.map(([insumoId, r]) => ({
        insumoId,
        cantidad: Number(r.cantidad),
        costoTotal: Number(r.costoTotal || 0),
        vencimiento: r.vencimiento || "",
      })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(`Compra registrada · ${lineasConCompra.length} insumos.`);
    router.push("/insumos");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label className="text-xs">Fecha *</Label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Proveedor</Label>
          <Select
            items={[
              { label: "Sin proveedor", value: SIN_PROV },
              ...proveedores.map((p) => ({ label: p.nombre, value: p.id })),
            ]}
            value={proveedorId || SIN_PROV}
            onValueChange={(v) =>
              setProveedorId(!v || v === SIN_PROV ? "" : String(v))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_PROV}>Sin proveedor</SelectItem>
              {proveedores.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Para el lote</Label>
          <Select
            items={[
              { label: "Stock general", value: STOCK_GRAL },
              ...lotes.map((l) => ({ label: l.nombre, value: l.id })),
              { label: "＋ Crear lote nuevo…", value: NUEVO_LOTE },
            ]}
            value={loteSel}
            onValueChange={(v) => setLoteSel(v ?? STOCK_GRAL)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STOCK_GRAL}>Stock general</SelectItem>
              {lotes.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nombre}
                </SelectItem>
              ))}
              <SelectItem value={NUEVO_LOTE}>＋ Crear lote nuevo…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loteSel === NUEVO_LOTE ? (
          <div className="grid gap-1.5">
            <Label className="text-xs">Nombre del lote nuevo *</Label>
            <Input
              value={nuevoLote}
              onChange={(e) => setNuevoLote(e.target.value)}
              placeholder="Lote N.º 3"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Precargar desde la receta de</Label>
          <Select
            items={terminados.map((t) => ({ label: t.nombre, value: t.id }))}
            value={prodSug || null}
            onValueChange={(v) => setProdSug(v ?? "")}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Elegí un producto" />
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
          <Label className="text-xs">Cantidad a fabricar</Label>
          <Input
            type="number"
            min="1"
            className="w-28"
            value={cantSug}
            onChange={(e) => setCantSug(e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" onClick={sugerir}>
          Sugerir
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Stock actual</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">Costo total ($)</TableHead>
              <TableHead className="text-right">Costo unit.</TableHead>
              <TableHead>Vencimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {insumos.map((i) => {
              const r = rows[i.id] ?? {
                cantidad: "",
                costoTotal: "",
                vencimiento: "",
              };
              const c = Number(r.cantidad) || 0;
              const t = Number(r.costoTotal) || 0;
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.unidad}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmtCantidad(Number(i.stock), (i.unidad as "kg" | "u") ?? "kg")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      className="ml-auto h-8 w-24 text-right"
                      value={r.cantidad}
                      onChange={(e) =>
                        setRow(i.id, { cantidad: e.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      className="ml-auto h-8 w-28 text-right"
                      value={r.costoTotal}
                      onChange={(e) =>
                        setRow(i.id, { costoTotal: e.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {c > 0 ? `${fmtMoney(t / c)} / ${i.unidad}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      className="h-8 w-36"
                      value={r.vencimiento}
                      onChange={(e) =>
                        setRow(i.id, { vencimiento: e.target.value })
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span>
          Líneas con compra: <b>{lineasConCompra.length}</b>
        </span>
        <span>
          Total: <b className="text-base">{fmtMoney(totalCompra)}</b>
        </span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={saving || lineasConCompra.length === 0}
        >
          {saving ? "Registrando…" : "Registrar compra"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/insumos")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
