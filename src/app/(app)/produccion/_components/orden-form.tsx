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
import { Textarea } from "@/components/ui/textarea";
import { crearOrden } from "@/features/produccion/actions";

type Opcion = { varianteId: string; label: string };

const hoy = () => new Date().toISOString().slice(0, 10);

export function OrdenForm({ terminados }: { terminados: Opcion[] }) {
  const router = useRouter();
  const [varianteTerminadoId, setVariante] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = terminados.map((t) => ({ label: t.label, value: t.varianteId }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await crearOrden({
      varianteTerminadoId,
      cantidad: Number(cantidad || 0),
      fecha,
      notas: notas || "",
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Orden creada.");
    router.push(`/produccion/${res.id}`);
    router.refresh();
  }

  if (terminados.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay productos con receta activa. Cargá una receta desde la ficha de un
        producto terminado.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-lg gap-4">
      <div className="grid gap-2">
        <Label>Producto a fabricar *</Label>
        <Select
          items={items}
          value={varianteTerminadoId || null}
          onValueChange={(v) => setVariante(v ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Elegí un producto con receta" />
          </SelectTrigger>
          <SelectContent>
            {items.map((it) => (
              <SelectItem key={it.value} value={it.value}>
                {it.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cant">Cantidad a producir *</Label>
          <Input
            id="cant"
            type="number"
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="fecha">Fecha *</Label>
          <Input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !varianteTerminadoId}>
          {saving ? "Creando…" : "Crear orden"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/produccion")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
