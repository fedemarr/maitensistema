"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { guardarProducto } from "@/features/productos/actions";
import type { Producto } from "@/features/productos/queries";
import type { Rubro } from "@/features/rubros/queries";

const SIN_RUBRO = "__none__";

export function ProductoForm({
  producto,
  rubros,
}: {
  producto?: Producto;
  rubros: Rubro[];
}) {
  const router = useRouter();
  const editing = Boolean(producto);

  const rubroItems = [
    { label: "Sin rubro", value: SIN_RUBRO },
    ...rubros.map((r) => ({ label: r.nombre, value: r.id })),
  ];

  const [sku, setSku] = useState(producto?.sku ?? "");
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [rubroId, setRubroId] = useState(producto?.rubroId ?? "");
  const [presentacion, setPresentacion] = useState(
    producto?.presentacion ?? "",
  );
  const [stockMinimo, setStockMinimo] = useState(
    String(producto?.stockMinimo ?? 50),
  );
  const [online, setOnline] = useState(producto?.online ?? false);
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await guardarProducto(
      {
        sku,
        nombre,
        rubroId: rubroId || "",
        presentacion: presentacion || "",
        stockMinimo: Number(stockMinimo || 0),
        online,
        activo,
      },
      producto?.id,
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Producto actualizado." : "Producto creado.");
    router.push(`/productos/${res.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sku">SKU *</Label>
          <Input
            id="sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="MAI-SH-AR-250"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nombre">Nombre *</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rubro">Rubro</Label>
          <Select
            items={rubroItems}
            value={rubroId || SIN_RUBRO}
            onValueChange={(v) =>
              setRubroId(!v || v === SIN_RUBRO ? "" : String(v))
            }
          >
            <SelectTrigger id="rubro" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rubroItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pres">Presentación</Label>
          <Input
            id="pres"
            value={presentacion}
            onChange={(e) => setPresentacion(e.target.value)}
            placeholder="250 ml"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="min">Stock mínimo</Label>
          <Input
            id="min"
            type="number"
            min="0"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={online} onCheckedChange={setOnline} />
          Se vende online
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={activo} onCheckedChange={setActivo} />
          Activo
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/productos")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
