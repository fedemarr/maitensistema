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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { crearMovimiento } from "@/features/movimientos/actions";
import type {
  MedioPago,
  VarianteCatalogo,
} from "@/features/movimientos/queries";
import {
  reglaDe,
  TIPO_LABEL,
  TIPO_MOVIMIENTO_MANUAL,
  type TipoMovimientoManual,
} from "@/features/movimientos/schema";
import { fmtMoney, fmtNumber } from "@/lib/format";

type Tertio = { id: string; nombre: string };
type ItemRow = {
  key: string;
  varianteId: string;
  cantidad: string;
  precioUnit: string;
  costoUnit: string;
};

const NULO = "__none__";

const hoy = () => new Date().toISOString().slice(0, 10);

export function MovimientoForm({
  clientes,
  proveedores,
  mediosPago,
  variantes,
}: {
  clientes: Tertio[];
  proveedores: Tertio[];
  mediosPago: MedioPago[];
  variantes: VarianteCatalogo[];
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoMovimientoManual>("ingreso");
  const regla = reglaDe(tipo);

  const [fecha, setFecha] = useState(hoy());
  const [clienteId, setClienteId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [medioPagoId, setMedioPagoId] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<ItemRow[]>([nuevoItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipoItems = TIPO_MOVIMIENTO_MANUAL.map((t) => ({
    label: TIPO_LABEL[t],
    value: t,
  }));

  const clienteItems = [
    { label: "Sin cliente", value: NULO },
    ...clientes.map((c) => ({ label: c.nombre, value: c.id })),
  ];
  const proveedorItems = [
    { label: "Sin proveedor", value: NULO },
    ...proveedores.map((p) => ({ label: p.nombre, value: p.id })),
  ];
  const medioItems = [
    { label: "Sin medio de pago", value: NULO },
    ...mediosPago.map((m) => ({ label: m.nombre, value: m.id })),
  ];

  function setItem(key: string, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function variantDe(id: string) {
    return variantes.find((v) => v.id === id);
  }

  function onVarianteChange(row: ItemRow, varianteId: string) {
    const v = variantDe(varianteId);
    setItem(row.key, {
      varianteId,
      // Autocompleta precio de lista en venta; en ingreso se deja en blanco.
      precioUnit: tipo === "venta" ? String(Number(v?.precioLista ?? 0)) : row.precioUnit,
    });
  }

  const itemsDeCatalogo = useMemo(() => {
    const filtered = variantes.filter((v) => v.activoProducto);
    return [
      { label: "Elegí una variante", value: NULO },
      ...filtered.map((v) => ({
        label: `${v.productoNombre} — ${v.nombre} (stock: ${v.stock})`,
        value: v.id,
      })),
    ];
  }, [variantes]);

  const requiereTercero = regla.tercero.includes("proveedor")
    ? "proveedor"
    : regla.tercero.includes("cliente")
      ? "cliente"
      : null;
  const terceroRequerido = regla.tercero.endsWith("-requerido");
  const pideMedio =
    regla.medioPago === "requerido" || regla.medioPago === "opcional";
  const medioRequerido = regla.medioPago === "requerido";
  const esAjuste = regla.signo === "ajuste";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Si requiere tercero y no se eligió, el server devuelve error; lo mostramos acá.
    const payload = {
      tipo,
      fecha,
      clienteId: clienteId || NULO,
      proveedorId: proveedorId || NULO,
      medioPagoId: medioPagoId || NULO,
      notas,
      items: items.map((i) => ({
        key: i.key,
        varianteId: i.varianteId,
        cantidad: Number(i.cantidad || 0),
        precioUnit: Number(i.precioUnit || 0),
        costoUnit: Number(i.costoUnit || 0),
      })),
    };

    const res = await crearMovimiento(payload);
    setSaving(false);

    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Movimiento creado.");
    router.push(`/movimientos/${res.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="tipo">Tipo *</Label>
          <Select
            items={tipoItems}
            value={tipo}
            onValueChange={(v) => {
              const next = v as TipoMovimientoManual;
              setTipo(next);
              // Reinicio el tercero/medio al cambiar de regla.
              setClienteId("");
              setProveedorId("");
              setMedioPagoId("");
            }}
          >
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tipoItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {requiereTercero === "cliente" ? (
        <div className="grid gap-2">
          <Label htmlFor="cliente">
            Cliente {terceroRequerido ? "*" : ""}
          </Label>
          <Select
            items={clienteItems}
            value={clienteId || NULO}
            onValueChange={(v) =>
              setClienteId(!v || v === NULO ? "" : String(v))
            }
          >
            <SelectTrigger id="cliente" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clienteItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {requiereTercero === "proveedor" ? (
        <div className="grid gap-2">
          <Label htmlFor="proveedor">
            Proveedor {terceroRequerido ? "*" : ""}
          </Label>
          <Select
            items={proveedorItems}
            value={proveedorId || NULO}
            onValueChange={(v) =>
              setProveedorId(!v || v === NULO ? "" : String(v))
            }
          >
            <SelectTrigger id="proveedor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {proveedorItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {pideMedio ? (
        <div className="grid gap-2">
          <Label htmlFor="medio">
            Medio de pago {medioRequerido ? "*" : ""}
          </Label>
          <Select
            items={medioItems}
            value={medioPagoId || NULO}
            onValueChange={(v) =>
              setMedioPagoId(!v || v === NULO ? "" : String(v))
            }
          >
            <SelectTrigger id="medio" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {medioItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {medioRequerido ? (
            <p className="text-xs text-muted-foreground">
              Si elegís un medio a crédito, se registra en la cuenta corriente
              del cliente.
            </p>
          ) : null}
        </div>
      ) : null}

      {regla.requiereNotas ? (
        <div className="grid gap-2">
          <Label htmlFor="notas">Motivo del ajuste *</Label>
          <Textarea
            id="notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Recuento físico, carga inicial, corrección…"
            required
            rows={2}
          />
        </div>
      ) : null}

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ítems</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems((r) => [...r, nuevoItem()])}
          >
            Agregar ítem
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead className="w-28">
                  {esAjuste ? "Objetivo" : "Cantidad"}
                </TableHead>
                <TableHead className="w-36">
                  {tipo === "venta" ? "Precio" : "Costo / Precio"}
                </TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const v = variantDe(item.varianteId);
                return (
                  <TableRow key={item.key}>
                    <TableCell>
                      <Select
                        items={itemsDeCatalogo}
                        value={item.varianteId || NULO}
                        onValueChange={(val) =>
                          onVarianteChange(item, !val || val === NULO ? "" : String(val))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {itemsDeCatalogo.map((it) => (
                            <SelectItem key={it.value} value={it.value}>
                              {it.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {v ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Stock actual:{" "}
                          <span
                            className={
                              v.stock <= 0
                                ? "font-semibold text-destructive"
                                : ""
                            }
                          >
                            {fmtNumber(v.stock)}
                          </span>{" "}
                          · Costo: {fmtMoney(v.costoPromedio)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={esAjuste ? 0 : 1}
                        value={item.cantidad}
                        onChange={(e) =>
                          setItem(item.key, { cantidad: e.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          tipo === "ingreso" ? item.costoUnit : item.precioUnit
                        }
                        onChange={(e) =>
                          tipo === "ingreso"
                            ? setItem(item.key, {
                                costoUnit: e.target.value,
                                precioUnit: e.target.value,
                              })
                            : setItem(item.key, { precioUnit: e.target.value })
                        }
                        placeholder={tipo === "ingreso" ? "costo" : "precio"}
                      />
                    </TableCell>
                    <TableCell>
                      {items.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs text-destructive underline"
                          onClick={() =>
                            setItems((r) => r.filter((x) => x.key !== item.key))
                          }
                        >
                          Quitar
                        </button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Crear movimiento"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/movimientos")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function nuevoItem(): ItemRow {
  return {
    key: crypto.randomUUID(),
    varianteId: "",
    cantidad: "1",
    precioUnit: "",
    costoUnit: "0",
  };
}
