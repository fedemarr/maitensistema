"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { nuevaVersionReceta } from "@/features/productos/actions";
import type {
  InsumoOpcion,
  RecetaDetalle,
} from "@/features/productos/queries";
import { fmtDate, fmtNumber } from "@/lib/format";

type Version = {
  id: string;
  numero: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  vigente: boolean;
  notas: string | null;
  ordenes: number;
};

type Row = { key: string; insumoId: string; cantidad: string };
const nueva = (): Row => ({ key: crypto.randomUUID(), insumoId: "", cantidad: "" });
const hoy = () => new Date().toISOString().slice(0, 10);

export function RecetaTab({
  productoId,
  vigente,
  versiones,
  insumos,
  editable,
}: {
  productoId: string;
  vigente: RecetaDetalle | null;
  versiones: Version[];
  insumos: InsumoOpcion[];
  editable: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState(hoy());
  const [notas, setNotas] = useState("");
  const [rows, setRows] = useState<Row[]>(
    vigente && vigente.lineas.length
      ? vigente.lineas.map((l) => ({
          key: l.id,
          insumoId: l.insumoId,
          cantidad: l.cantidadPorUnidad,
        }))
      : [nueva()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insumoItems = insumos.map((i) => ({ label: i.nombre, value: i.id }));
  const unidadDe = (id: string) => insumos.find((i) => i.id === id)?.unidad ?? "kg";

  function setRow(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function guardar() {
    setSaving(true);
    setError(null);
    const res = await nuevaVersionReceta({
      productoId,
      vigenteDesde: desde,
      notas: notas || "",
      lineas: rows.map((r) => ({
        insumoId: r.insumoId,
        cantidadPorUnidad: Number(r.cantidad || 0),
      })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Nueva versión de receta guardada.");
    setAbierto(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Receta vigente
            {vigente ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                v{vigente.numero} · desde {fmtDate(vigente.vigenteDesde)}
              </span>
            ) : null}
          </CardTitle>
          {editable ? (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAbierto((v) => !v)}
              >
                {abierto ? "Cerrar" : vigente ? "Nueva versión" : "Cargar receta"}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {!vigente ? (
            <p className="text-sm text-muted-foreground">
              Sin receta. {editable ? "Cargala para poder producir." : ""}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">
                      Cantidad / unidad terminada
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vigente.lineas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {l.insumoNombre}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.unidad}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.unidad === "kg"
                          ? fmtNumber(Number(l.cantidadPorUnidad), 4)
                          : fmtNumber(Number(l.cantidadPorUnidad))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {abierto ? (
            <div className="mt-4 space-y-3 border-t pt-4">
              {insumos.length === 0 ? (
                <p className="text-sm text-destructive">
                  No hay insumos cargados. Creá insumos primero.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs">Vigente desde *</Label>
                  <Input
                    type="date"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Notas</Label>
                  <Input
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Motivo del cambio…"
                  />
                </div>
              </div>

              {rows.map((r, i) => (
                <div
                  key={r.key}
                  className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]"
                >
                  <Select
                    items={insumoItems}
                    value={r.insumoId || null}
                    onValueChange={(v) => setRow(r.key, { insumoId: v ?? "" })}
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
                    step="0.0001"
                    min="0"
                    placeholder={`Cant. (${unidadDe(r.insumoId)})`}
                    value={r.cantidad}
                    onChange={(e) => setRow(r.key, { cantidad: e.target.value })}
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
                onClick={() => setRows((rs) => [...rs, nueva()])}
              >
                Agregar línea
              </Button>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <div>
                <Button onClick={guardar} disabled={saving}>
                  {saving ? "Guardando…" : "Guardar versión"}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versiones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Versión</TableHead>
                  <TableHead>Vigente desde</TableHead>
                  <TableHead>Vigente hasta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Órdenes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versiones.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">v{v.numero}</TableCell>
                    <TableCell>{fmtDate(v.vigenteDesde)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.vigenteHasta ? fmtDate(v.vigenteHasta) : "—"}
                    </TableCell>
                    <TableCell>
                      {v.vigente ? (
                        <Badge variant="secondary">Vigente</Badge>
                      ) : (
                        <Badge variant="outline">Histórica</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {v.ordenes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
