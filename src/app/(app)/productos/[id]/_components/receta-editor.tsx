"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { guardarReceta } from "@/features/recetas/actions";
import type { RecetaActiva } from "@/features/recetas/queries";
import type { VarianteOpcion } from "@/features/productos/queries";
import { fmtMoney } from "@/lib/format";

type Row = {
  key: string;
  varianteInsumoId: string;
  cantidad: string;
  mermaPct: string;
};

const nuevaRow = (): Row => ({
  key: crypto.randomUUID(),
  varianteInsumoId: "",
  cantidad: "",
  mermaPct: "0",
});

export function RecetaEditor({
  varianteTerminadoId,
  varianteNombre,
  receta,
  insumos,
  editable,
}: {
  varianteTerminadoId: string;
  varianteNombre: string;
  receta: RecetaActiva | null;
  insumos: VarianteOpcion[];
  editable: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [rinde, setRinde] = useState(String(receta?.rinde ?? 1));
  const [rows, setRows] = useState<Row[]>(
    receta && receta.items.length
      ? receta.items.map((it) => ({
          key: it.id,
          varianteInsumoId: it.varianteInsumoId,
          cantidad: it.cantidad,
          mermaPct: it.mermaPct,
        }))
      : [nuevaRow()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insumoItems = insumos.map((i) => ({
    label: i.label,
    value: i.varianteId,
  }));

  function setRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function guardar() {
    setSaving(true);
    setError(null);
    const res = await guardarReceta({
      varianteTerminadoId,
      rinde: Number(rinde || 0),
      notas: "",
      items: rows.map((r) => ({
        varianteInsumoId: r.varianteInsumoId,
        cantidad: Number(r.cantidad || 0),
        mermaPct: Number(r.mermaPct || 0),
      })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Receta guardada.");
    setAbierto(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">
          Receta — {varianteNombre}
        </CardTitle>
        {editable ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAbierto((v) => !v)}
          >
            {abierto ? "Cerrar" : receta ? "Editar" : "Cargar receta"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {!abierto ? (
          receta ? (
            <ul className="text-sm">
              <li className="text-muted-foreground">
                Rinde {receta.rinde} u. por lote:
              </li>
              {receta.items.map((it) => (
                <li key={it.id} className="tabular-nums">
                  {Number(it.cantidad)} {it.mermaPct !== "0.00" ? `(+${Number(it.mermaPct)}% merma) ` : ""}
                  · {it.insumoLabel} ·{" "}
                  <span className="text-muted-foreground">
                    {fmtMoney(it.costoPromedio)}/u
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sin receta. {editable ? "Cargala para poder producir." : ""}
            </p>
          )
        ) : (
          <div className="space-y-3">
            {insumos.length === 0 ? (
              <p className="text-sm text-destructive">
                No hay insumos cargados. Creá insumos primero.
              </p>
            ) : null}

            <div className="flex items-end gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Rinde (u. por lote) *</Label>
                <Input
                  type="number"
                  min="1"
                  className="w-28"
                  value={rinde}
                  onChange={(e) => setRinde(e.target.value)}
                />
              </div>
            </div>

            {rows.map((r, i) => (
              <div key={r.key} className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]">
                <Select
                  items={insumoItems}
                  value={r.varianteInsumoId || null}
                  onValueChange={(v) => setRow(r.key, { varianteInsumoId: v ?? "" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {insumoItems.map((it) => (
                      <SelectItem key={it.value} value={it.value}>
                        {it.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="Cant."
                  value={r.cantidad}
                  onChange={(e) => setRow(r.key, { cantidad: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="% merma"
                  value={r.mermaPct}
                  onChange={(e) => setRow(r.key, { mermaPct: e.target.value })}
                />
                {rows.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs text-destructive underline"
                    onClick={() =>
                      setRows((rs) => rs.filter((x) => x.key !== r.key))
                    }
                  >
                    Quitar {i + 1}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((rs) => [...rs, nuevaRow()])}
            >
              Agregar insumo
            </Button>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <div className="flex gap-2">
              <Button onClick={guardar} disabled={saving}>
                {saving ? "Guardando…" : "Guardar receta"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
