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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { guardarProducto } from "@/features/productos/actions";
import type { ProductoConVariantes } from "@/features/productos/queries";
import type { Rubro } from "@/features/rubros/queries";
import { createClient } from "@/lib/supabase/client";

type VarianteRow = {
  key: string;
  id?: string;
  nombre: string;
  presentacion: string;
  fragancia: string;
  stock: string;
  stockMin: string;
  costoPromedio: string;
};

const SIN_RUBRO = "__none__";

const nuevaVariante = (): VarianteRow => ({
  key: crypto.randomUUID(),
  nombre: "",
  presentacion: "",
  fragancia: "",
  stock: "0",
  stockMin: "0",
  costoPromedio: "0",
});

function fromProducto(p: ProductoConVariantes): VarianteRow[] {
  return p.variantes
    .filter((v) => v.activo)
    .map((v) => ({
      key: v.id,
      id: v.id,
      nombre: v.nombre,
      presentacion: v.presentacion ?? "",
      fragancia: v.fragancia ?? "",
      stock: String(v.stock),
      stockMin: String(v.stockMin),
      costoPromedio: String(v.costoPromedio),
    }));
}

export function ProductoForm({
  producto,
  rubros,
  esInsumo: esInsumoProp = false,
}: {
  producto?: ProductoConVariantes;
  rubros: Rubro[];
  esInsumo?: boolean;
}) {
  const router = useRouter();
  const editing = Boolean(producto);
  const esInsumo = producto?.esInsumo ?? esInsumoProp;
  const base = esInsumo ? "/insumos" : "/productos";
  const rubroItems = [
    { label: "Sin rubro", value: SIN_RUBRO },
    ...rubros.map((r) => ({ label: r.nombre, value: r.id })),
  ];

  const [sku, setSku] = useState(producto?.sku ?? "");
  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [rubroId, setRubroId] = useState(producto?.rubroId ?? "");
  const [precio, setPrecio] = useState(String(producto?.precioLista ?? "0"));
  const [online, setOnline] = useState(producto?.online ?? false);
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [fotoPath, setFotoPath] = useState(producto?.fotoPath ?? "");
  const [variantes, setVariantes] = useState<VarianteRow[]>(
    producto ? fromProducto(producto) : [nuevaVariante()],
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setVar(key: string, patch: Partial<VarianteRow>) {
    setVariantes((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  async function onFoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("productos")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      setFotoPath(path);
      toast.success("Foto subida.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir la foto.";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      sku,
      nombre,
      rubroId: rubroId || "",
      precioLista: Number(precio),
      online: esInsumo ? false : online,
      activo,
      esInsumo,
      fotoPath: fotoPath || "",
      variantes: variantes.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        presentacion: v.presentacion || "",
        fragancia: v.fragancia || "",
        stock: Number(v.stock),
        stockMin: Number(v.stockMin),
        costoPromedio: Number(v.costoPromedio),
      })),
    };

    const res = await guardarProducto(payload, producto?.id);
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
    <form onSubmit={onSubmit} className="space-y-6">
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
          <Label htmlFor="precio">Precio de lista</Label>
          <Input
            id="precio"
            type="number"
            min="0"
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        {!esInsumo ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={online} onCheckedChange={setOnline} />
            Se vende online
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={activo} onCheckedChange={setActivo} />
          Activo
        </label>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="foto">Foto</Label>
        <Input
          id="foto"
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFoto(f);
          }}
        />
        {fotoPath ? (
          <p className="text-xs text-muted-foreground">
            Archivo: <span className="font-mono">{fotoPath}</span>{" "}
            <button
              type="button"
              className="underline"
              onClick={() => setFotoPath("")}
            >
              quitar
            </button>
          </p>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Variantes</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVariantes((r) => [...r, nuevaVariante()])}
          >
            Agregar variante
          </Button>
        </div>

        {variantes.map((v, i) => (
          <div key={v.key} className="rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Nombre *</Label>
                <Input
                  value={v.nombre}
                  onChange={(e) => setVar(v.key, { nombre: e.target.value })}
                  placeholder="250 ml"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Presentación</Label>
                <Input
                  value={v.presentacion}
                  onChange={(e) =>
                    setVar(v.key, { presentacion: e.target.value })
                  }
                  placeholder="250 ml"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Fragancia</Label>
                <Input
                  value={v.fragancia}
                  onChange={(e) => setVar(v.key, { fragancia: e.target.value })}
                  placeholder="neutra"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  {v.id ? "Stock actual" : "Stock inicial"}
                </Label>
                {v.id ? (
                  <>
                    <Input value={v.stock} disabled />
                    <p className="text-[11px] text-muted-foreground">
                      Se ajusta desde Movimientos.
                    </p>
                  </>
                ) : (
                  <Input
                    type="number"
                    min="0"
                    value={v.stock}
                    onChange={(e) => setVar(v.key, { stock: e.target.value })}
                    placeholder="0"
                  />
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Stock mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  value={v.stockMin}
                  onChange={(e) => setVar(v.key, { stockMin: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  {v.id ? "Costo promedio" : "Costo inicial"}
                </Label>
                {v.id ? (
                  <>
                    <Input value={v.costoPromedio} disabled />
                    <p className="text-[11px] text-muted-foreground">
                      Se ajusta desde Movimientos.
                    </p>
                  </>
                ) : (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={v.costoPromedio}
                    onChange={(e) =>
                      setVar(v.key, { costoPromedio: e.target.value })
                    }
                    placeholder="0"
                  />
                )}
              </div>
            </div>
            {variantes.length > 1 ? (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  className="text-xs text-destructive underline"
                  onClick={() =>
                    setVariantes((r) => r.filter((x) => x.key !== v.key))
                  }
                >
                  Quitar variante {i + 1}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || uploading}>
          {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(base)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
