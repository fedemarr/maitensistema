"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { crearMovimiento } from "@/features/movimientos/actions";
import {
  IMPACTO_LABEL,
  MEDIO_PAGO_LABEL,
  MEDIOS_PAGO,
  reglaDe,
  TIPO_LABEL,
  TIPOS_MANUAL,
  type MedioPago,
  type TipoManual,
} from "@/features/movimientos/schema";
import { TIPO_LABEL as CLIENTE_TIPO_LABEL, tipoClienteEnum } from "@/features/clientes/schema";
import type { ProductoConPrecios } from "@/features/precios/queries";
import { TIPOS_CLIENTE_MAYORISTA } from "@/features/precios/schema";
import { fmtMoney } from "@/lib/format";

type Prod = { id: string; nombre: string; ppp: string };
type Cli = { id: string; nombre: string; tipo: string };
type Lote = { id: string; nombre: string };

const NUEVO_CLI = "__new__";
const SIN_CLI = "__none__";

export function MovimientoForm({
  productos,
  clientes,
  lotes,
  precios,
  pre,
}: {
  productos: Prod[];
  clientes: Cli[];
  lotes: Lote[];
  precios: ProductoConPrecios[];
  pre?: {
    tipo?: string;
    clienteId?: string;
    productoId?: string;
    cantidad?: string;
  };
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoManual>(
    (TIPOS_MANUAL as readonly string[]).includes(pre?.tipo ?? "")
      ? (pre!.tipo as TipoManual)
      : "venta",
  );
  const regla = reglaDe(tipo);

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [clienteId, setClienteId] = useState(pre?.clienteId ?? "");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<string>("particular");
  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo");
  const [loteId, setLoteId] = useState("");
  const [obs, setObs] = useState("");
  const [items, setItems] = useState<
    {
      key: string;
      productoId: string;
      cantidad: string;
      precio: string;
      /** El precio vino de la sugerencia (no lo tocó la mano): se puede
       * recalcular si cambia el producto o el cliente. Se apaga apenas la
       * persona edita el campo a mano. */
      precioAuto: boolean;
    }[]
  >([
    {
      key: crypto.randomUUID(),
      productoId: pre?.productoId ?? productos[0]?.id ?? "",
      cantidad: pre?.cantidad ?? "1",
      precio: "",
      precioAuto: true,
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pppById = useMemo(
    () => new Map(productos.map((p) => [p.id, Number(p.ppp)])),
    [productos],
  );

  const precioMap = useMemo(
    () =>
      new Map(
        precios.map((p) => [
          p.productoId,
          {
            retail: p.retail ? Number(p.retail.precioConIva) : null,
            mayorista: p.mayorista ? Number(p.mayorista.precioConIva) : null,
          },
        ]),
      ),
    [precios],
  );

  const tipoClienteActual = () => {
    if (clienteId === NUEVO_CLI) return nuevoTipo;
    return clientes.find((c) => c.id === clienteId)?.tipo ?? null;
  };

  /** Precio sugerido (retail o mayorista según el tipo de cliente actual). */
  function precioSugerido(productoId: string, esMayorista: boolean): number | null {
    const entry = precioMap.get(productoId);
    if (!entry) return null;
    return esMayorista ? (entry.mayorista ?? entry.retail) : entry.retail;
  }

  /** Recalcula el precio de los ítems que siguen en modo "sugerido" (no
   * editados a mano) para el tipo de cliente actual. */
  function recalcularPreciosAuto(esMayorista: boolean) {
    setItems((is) =>
      is.map((i) => {
        if (!i.precioAuto || !i.productoId) return i;
        const sugerido = precioSugerido(i.productoId, esMayorista);
        return sugerido != null ? { ...i, precio: String(sugerido) } : i;
      }),
    );
  }

  const resumen = useMemo(() => {
    let ing = 0;
    let costo = 0;
    for (const it of items) {
      const q = Math.abs(Number(it.cantidad) || 0);
      const ppp = pppById.get(it.productoId) ?? 0;
      if (regla.impacto === "ingreso")
        ing += (q * (Number(it.precio) || 0)) / 1.21;
      if (regla.generaCosto && regla.deposito !== "no") costo += q * ppp;
      if (regla.consig === "vender") costo += q * ppp;
    }
    return { ing, costo };
  }, [items, pppById, regla]);

  function setItem(key: string, patch: Partial<(typeof items)[number]>) {
    setItems((is) => is.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const usarNuevo = clienteId === NUEVO_CLI;
    const res = await crearMovimiento({
      tipo,
      fecha,
      clienteId: usarNuevo ? "__new__" : clienteId || "",
      nuevoCliente:
        usarNuevo && nuevoNombre.trim()
          ? {
              nombre: nuevoNombre.trim(),
              tipo: nuevoTipo as (typeof tipoClienteEnum)[number],
            }
          : undefined,
      medioPago: regla.pideMedioPago ? medioPago : null,
      loteId: tipo === "ajuste" ? loteId || "" : "",
      observaciones: obs || "",
      items: items.map((i) => ({
        productoId: i.productoId,
        cantidad: Number(i.cantidad || 0),
        precioConIva: regla.pidePrecio ? Number(i.precio || 0) : undefined,
      })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Movimiento creado.");
    router.push("/movimientos");
    router.refresh();
  }

  const prodItems = productos.map((p) => ({ label: p.nombre, value: p.id }));

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Tipo *</Label>
          <Select
            items={TIPOS_MANUAL.map((t) => ({ label: TIPO_LABEL[t], value: t }))}
            value={tipo}
            onValueChange={(v) => {
              setTipo((v as TipoManual) ?? "venta");
              setClienteId("");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_MANUAL.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Fecha *</Label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        {regla.pideMedioPago ? (
          <div className="grid gap-1.5">
            <Label className="text-xs">Medio de pago *</Label>
            <Select
              items={MEDIOS_PAGO.map((m) => ({
                label: MEDIO_PAGO_LABEL[m],
                value: m,
              }))}
              value={medioPago}
              onValueChange={(v) => setMedioPago((v as MedioPago) ?? "efectivo")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDIOS_PAGO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MEDIO_PAGO_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {regla.tercero !== "ninguno" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5 sm:col-span-1">
            <Label className="text-xs">
              Cliente{regla.tercero === "cliente_req" ? " *" : ""}
            </Label>
            <Select
              items={[
                { label: "— sin especificar —", value: SIN_CLI },
                ...clientes.map((c) => ({
                  label: `${c.nombre} · ${c.tipo}`,
                  value: c.id,
                })),
                { label: "＋ Nuevo cliente…", value: NUEVO_CLI },
              ]}
              value={clienteId || SIN_CLI}
              onValueChange={(v) => {
                const nuevo = !v || v === SIN_CLI ? "" : String(v);
                setClienteId(nuevo);
                if (!regla.pidePrecio) return;
                const tipoCli =
                  nuevo === NUEVO_CLI
                    ? nuevoTipo
                    : (clientes.find((c) => c.id === nuevo)?.tipo ?? null);
                const esMayorista = (
                  TIPOS_CLIENTE_MAYORISTA as readonly string[]
                ).includes(tipoCli ?? "");
                recalcularPreciosAuto(esMayorista);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_CLI}>— sin especificar —</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
                <SelectItem value={NUEVO_CLI}>＋ Nuevo cliente…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {clienteId === NUEVO_CLI ? (
            <>
              <div className="grid gap-1.5">
                <Label className="text-xs">Nombre del cliente nuevo *</Label>
                <Input
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Tipo *</Label>
                <Select
                  items={tipoClienteEnum.map((t) => ({
                    label: CLIENTE_TIPO_LABEL[t],
                    value: t,
                  }))}
                  value={nuevoTipo}
                  onValueChange={(v) => {
                    const tipo = v ?? "particular";
                    setNuevoTipo(tipo);
                    if (!regla.pidePrecio) return;
                    const esMayorista = (
                      TIPOS_CLIENTE_MAYORISTA as readonly string[]
                    ).includes(tipo);
                    recalcularPreciosAuto(esMayorista);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoClienteEnum.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CLIENTE_TIPO_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {tipo === "ajuste" ? (
        <div className="grid max-w-xs gap-1.5">
          <Label className="text-xs">
            Lote (para ajustes que suman stock)
          </Label>
          <Select
            items={lotes.map((l) => ({ label: l.nombre, value: l.id }))}
            value={loteId || null}
            onValueChange={(v) => setLoteId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {lotes.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Impacto en el reporte:
        </span>{" "}
        <Badge variant="secondary">{IMPACTO_LABEL[regla.impacto]}</Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ítems</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setItems((is) => [
                ...is,
                {
                  key: crypto.randomUUID(),
                  productoId: productos[0]?.id ?? "",
                  cantidad: "1",
                  precio: "",
                  precioAuto: true,
                },
              ])
            }
          >
            Agregar ítem
          </Button>
        </div>
        {items.map((it, idx) => (
          <div
            key={it.key}
            className="grid gap-2 sm:grid-cols-[1fr_7rem_9rem_auto]"
          >
            <Select
              items={prodItems}
              value={it.productoId || null}
              onValueChange={(v) => {
                const productoId = v ?? "";
                const esMayorista = (
                  TIPOS_CLIENTE_MAYORISTA as readonly string[]
                ).includes(tipoClienteActual() ?? "");
                const sugerido =
                  regla.pidePrecio && it.precioAuto && productoId
                    ? precioSugerido(productoId, esMayorista)
                    : null;
                setItem(it.key, {
                  productoId,
                  ...(sugerido != null ? { precio: String(sugerido) } : {}),
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Producto" />
              </SelectTrigger>
              <SelectContent>
                {prodItems.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step={tipo === "ajuste" ? "1" : "1"}
              placeholder={tipo === "ajuste" ? "± cant." : "Cantidad"}
              value={it.cantidad}
              onChange={(e) => setItem(it.key, { cantidad: e.target.value })}
            />
            {regla.pidePrecio ? (
              <Input
                type="number"
                step="any"
                placeholder="Precio + IVA / u"
                value={it.precio}
                onChange={(e) =>
                  setItem(it.key, {
                    precio: e.target.value,
                    precioAuto: false,
                  })
                }
              />
            ) : (
              <span />
            )}
            {items.length > 1 ? (
              <button
                type="button"
                className="text-xs text-destructive underline"
                onClick={() =>
                  setItems((is) => is.filter((x) => x.key !== it.key))
                }
              >
                Quitar {idx + 1}
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Observaciones</Label>
        <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-6 rounded-lg border bg-muted/30 p-3 text-sm">
        <span>
          Ingreso neto: <b>{fmtMoney(resumen.ing)}</b>
        </span>
        <span>
          Costo (PPP): <b>{fmtMoney(resumen.costo)}</b>
        </span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Creando…" : "Crear movimiento"}
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
