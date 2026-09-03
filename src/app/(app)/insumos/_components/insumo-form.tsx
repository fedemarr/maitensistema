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
import { guardarInsumo } from "@/features/insumos/actions";
import type { Insumo } from "@/features/insumos/queries";

const SIN_PROV = "__none__";

export function InsumoForm({
  insumo,
  proveedores,
}: {
  insumo?: Insumo;
  proveedores: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const editing = Boolean(insumo);

  const provItems = [
    { label: "Sin proveedor habitual", value: SIN_PROV },
    ...proveedores.map((p) => ({ label: p.nombre, value: p.id })),
  ];

  const [sku, setSku] = useState(insumo?.sku ?? "");
  const [nombre, setNombre] = useState(insumo?.nombre ?? "");
  const [unidad, setUnidad] = useState<"kg" | "u">(
    (insumo?.unidad as "kg" | "u") ?? "kg",
  );
  const [reutilizable, setReutilizable] = useState(insumo?.reutilizable ?? false);
  const [vence, setVence] = useState(insumo?.vence ?? false);
  const [proveedorHabitualId, setProv] = useState(
    insumo?.proveedorHabitualId ?? "",
  );
  const [activo, setActivo] = useState(insumo?.activo ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await guardarInsumo(
      {
        sku,
        nombre,
        unidad,
        reutilizable,
        vence,
        proveedorHabitualId: proveedorHabitualId || "",
        activo,
      },
      insumo?.id,
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(editing ? "Insumo actualizado." : "Insumo creado.");
    router.push("/insumos");
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
            placeholder="INS-GLICERINA"
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
          <Label htmlFor="unidad">Unidad *</Label>
          <Select
            items={[
              { label: "Kilogramos (kg)", value: "kg" },
              { label: "Unidades (u)", value: "u" },
            ]}
            value={unidad}
            onValueChange={(v) => setUnidad((v as "kg" | "u") ?? "kg")}
          >
            <SelectTrigger id="unidad" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">Kilogramos (kg)</SelectItem>
              <SelectItem value="u">Unidades (u)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="prov">Proveedor habitual</Label>
          <Select
            items={provItems}
            value={proveedorHabitualId || SIN_PROV}
            onValueChange={(v) =>
              setProv(!v || v === SIN_PROV ? "" : String(v))
            }
          >
            <SelectTrigger id="prov" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={reutilizable} onCheckedChange={setReutilizable} />
          Reutilizable entre lotes
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={vence} onCheckedChange={setVence} />
          Vence / se seca
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={activo} onCheckedChange={setActivo} />
          Activo
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        El stock y el costo (PPP) del insumo se alimentan de las compras y las
        bajas — no se cargan acá.
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear insumo"}
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
