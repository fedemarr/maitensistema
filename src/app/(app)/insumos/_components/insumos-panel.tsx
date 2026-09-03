"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { registrarBaja } from "@/features/insumos/actions";
import type { InsumoListItem } from "@/features/insumos/queries";
import { MOTIVO_BAJA, MOTIVO_LABEL, type MotivoBaja } from "@/features/insumos/schema";
import { fmtCantidad, fmtMoney } from "@/lib/format";

const hoy = () => new Date().toISOString().slice(0, 10);

export function InsumosPanel({
  insumos,
  editable,
}: {
  insumos: InsumoListItem[];
  editable: boolean;
}) {
  const [q, setQ] = useState("");
  const [reut, setReut] = useState<"" | "1" | "0">("");
  const [bajaOpen, setBajaOpen] = useState(false);
  const [bajaInsumo, setBajaInsumo] = useState("");
  const [cant, setCant] = useState("");
  const [motivo, setMotivo] = useState<MotivoBaja>("vencido");
  const [fecha, setFecha] = useState(hoy());
  const [saving, setSaving] = useState(false);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return insumos.filter((i) => {
      if (t && !i.nombre.toLowerCase().includes(t)) return false;
      if (reut === "1" && !i.reutilizable) return false;
      if (reut === "0" && i.reutilizable) return false;
      return true;
    });
  }, [q, reut, insumos]);

  const sel = insumos.find((i) => i.id === bajaInsumo);

  async function doBaja() {
    setSaving(true);
    const res = await registrarBaja({
      fecha,
      insumoId: bajaInsumo,
      cantidad: Number(cant || 0),
      motivo,
      loteId: "",
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Baja registrada · pérdida en el reporte.");
    setBajaOpen(false);
    setCant("");
    location.reload();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar insumo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select
          items={[
            { label: "Todos", value: "all" },
            { label: "Solo reutilizables", value: "1" },
            { label: "Solo no reutilizables", value: "0" },
          ]}
          value={reut || "all"}
          onValueChange={(v) => setReut(v === "all" || !v ? "" : (v as "1" | "0"))}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="1">Solo reutilizables</SelectItem>
            <SelectItem value="0">Solo no reutilizables</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          {editable ? (
            <>
              <Button variant="outline" onClick={() => setBajaOpen(true)}>
                Dar de baja
              </Button>
              <Button render={<Link href="/insumos/compra" />}>
                Registrar compra
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Reutilizable</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">PPP</TableHead>
              <TableHead className="text-right">Valor stock</TableHead>
              <TableHead>Lo usa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <Link
                    href={`/insumos/${i.id}/editar`}
                    className="font-medium hover:underline"
                  >
                    {i.nombre}
                  </Link>
                  {!i.activo ? (
                    <Badge variant="outline" className="ml-2">
                      Inactivo
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {i.unidad}
                </TableCell>
                <TableCell>
                  {i.reutilizable ? (
                    <Badge variant="secondary">Sí</Badge>
                  ) : (
                    <Badge variant="outline" className="text-destructive">
                      No
                    </Badge>
                  )}
                  {i.vence ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      vence
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {i.stock > 0 ? (
                    fmtCantidad(i.stock, i.unidad)
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMoney(i.ppp)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {i.stock > 0 ? (
                    fmtMoney(i.valorStock)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {i.loUsa.length ? i.loUsa.join(" · ") : "—"}
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin insumos.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={bajaOpen} onOpenChange={setBajaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja insumo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Insumo</Label>
              <Select
                items={insumos.map((i) => ({ label: i.nombre, value: i.id }))}
                value={bajaInsumo || null}
                onValueChange={(v) => setBajaInsumo(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí un insumo" />
                </SelectTrigger>
                <SelectContent>
                  {insumos.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">
                  Cantidad {sel ? `(${sel.unidad})` : ""}
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={cant}
                  onChange={(e) => setCant(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Motivo</Label>
              <Select
                items={MOTIVO_BAJA.map((m) => ({
                  label: MOTIVO_LABEL[m],
                  value: m,
                }))}
                value={motivo}
                onValueChange={(v) => setMotivo((v as MotivoBaja) ?? "vencido")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVO_BAJA.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MOTIVO_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sel ? (
              <p className="text-xs text-muted-foreground">
                Pérdida estimada: {fmtMoney(Number(cant || 0) * sel.ppp)} ·
                stock resultante:{" "}
                {fmtCantidad(Math.max(0, sel.stock - Number(cant || 0)), sel.unidad)}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBajaOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={doBaja}
              disabled={saving || !bajaInsumo || !Number(cant)}
            >
              {saving ? "Registrando…" : "Dar de baja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
