"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { FacturarDialog } from "@/features/afip/_components/facturar-dialog";
import { NotaCreditoDialog } from "@/features/afip/_components/nota-credito-dialog";
import { marcarFacturaExterna } from "@/features/afip/actions";
import {
  anularMovimiento,
  editarCamposLibres,
  editarMovimiento,
  reasignarLote,
} from "@/features/movimientos/actions";
import type {
  CambioAuditoria,
  MovimientoDetalle,
} from "@/features/movimientos/queries";
import {
  MEDIO_PAGO_LABEL,
  MEDIOS_PAGO,
  TIPO_LABEL,
  TIPOS_MANUAL,
  type MedioPago,
  type TipoManual,
} from "@/features/movimientos/schema";
import type { Rol } from "@/lib/auth";
import { fmtDateHora, fmtMoney } from "@/lib/format";

const EDITABLES_CON_RECALCULO = new Set<string>([
  "venta",
  "canje",
  "presentacion",
  "regalo",
  "rotura",
  "sorteo",
  "tester",
  "co_branding",
  "influencer",
  "prueba",
  "ajuste",
]);

const ESTADO_LABEL: Record<string, string> = {
  vigente: "Vigente",
  anulado: "Anulado",
  con_nc_total: "Con nota de crédito total",
};

type Prod = { id: string; nombre: string; ppp: string };
type Cli = { id: string; nombre: string; tipo: string };
type Lote = { id: string; nombre: string };

export function MovimientoDetalleView({
  detalle,
  historial,
  productos,
  clientes,
  lotes,
  rol,
}: {
  detalle: MovimientoDetalle;
  historial: CambioAuditoria[];
  productos: Prod[];
  clientes: Cli[];
  lotes: Lote[];
  rol: Rol;
}) {
  const puedeEscribir = rol === "admin" || rol === "ventas";
  const esAdmin = rol === "admin";

  const tieneFactura = Boolean(detalle.factura);
  const editableConRecalculo =
    !tieneFactura && detalle.estado === "vigente" && EDITABLES_CON_RECALCULO.has(detalle.tipo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{TIPO_LABEL[detalle.tipo] ?? detalle.tipo}</h1>
          {detalle.estado !== "vigente" ? (
            <Badge variant="outline" className="text-destructive">
              {ESTADO_LABEL[detalle.estado] ?? detalle.estado}
            </Badge>
          ) : null}
        </div>
        <Acciones detalle={detalle} puedeEscribir={puedeEscribir} esAdmin={esAdmin} />
      </div>

      {tieneFactura ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p>
            Este movimiento tiene factura emitida:{" "}
            <a href={`/api/facturas/${detalle.factura!.id}/pdf`} className="font-medium underline">
              {detalle.factura!.tipoComprobante}{" "}
              {String(detalle.factura!.puntoVenta).padStart(5, "0")}-
              {String(detalle.factura!.numero).padStart(8, "0")}
            </a>
            . Los datos del comprobante no se pueden modificar. Para corregirlo, emití una nota de
            crédito.
          </p>
          {detalle.notasCredito.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {detalle.notasCredito.map((nc) => (
                <li key={nc.id} className="text-xs">
                  <a href={`/api/facturas/${nc.id}/pdf`} className="underline">
                    {nc.tipoComprobante} {String(nc.puntoVenta).padStart(5, "0")}-
                    {String(nc.numero).padStart(8, "0")}
                  </a>{" "}
                  · {fmtMoney(nc.importeTotal)} · {nc.motivo} · {fmtDateHora(nc.createdAt)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {editableConRecalculo ? (
        <FormularioEdicion detalle={detalle} productos={productos} clientes={clientes} lotes={lotes} />
      ) : (
        <VistaSoloLectura detalle={detalle} esAdmin={esAdmin} puedeEscribir={puedeEscribir} lotes={lotes} />
      )}

      <Historial historial={historial} />
    </div>
  );
}

function Acciones({
  detalle,
  puedeEscribir,
  esAdmin,
}: {
  detalle: MovimientoDetalle;
  puedeEscribir: boolean;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [anulando, startAnular] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const facturable = detalle.tipo === "venta" || detalle.tipo === "venta_consignacion";

  if (!puedeEscribir) return null;

  if (detalle.estado === "con_nc_total") {
    const params = new URLSearchParams({ desde: detalle.id });
    return (
      <Button variant="outline" render={<a href={`/movimientos/nuevo?${params}`} />}>
        Cargar movimiento corregido
      </Button>
    );
  }
  if (detalle.estado === "anulado") return null;

  if (detalle.factura) {
    return (
      <NotaCreditoDialog
        movimientoId={detalle.id}
        onEmitida={() => router.refresh()}
        trigger={<Button variant="outline">Emitir nota de crédito</Button>}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      {facturable ? (
        <FacturarDialog
          movimientoId={detalle.id}
          onEmitida={() => router.refresh()}
          trigger={<Button variant="outline">Facturar</Button>}
        />
      ) : null}
      {facturable && esAdmin ? (
        <FacturaExternaDialog movimientoId={detalle.id} onGuardada={() => router.refresh()} />
      ) : null}
      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirmar(true)}>
          Anular
        </Button>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Anular este movimiento?</DialogTitle>
            <DialogDescription>
              Devuelve el stock/consignación afectada. No se puede deshacer, pero el movimiento
              queda visible como anulado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)} disabled={anulando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={anulando}
              onClick={() =>
                startAnular(async () => {
                  const res = await anularMovimiento(detalle.id);
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Movimiento anulado.");
                  setConfirmar(false);
                  router.refresh();
                })
              }
            >
              {anulando ? "Anulando…" : "Anular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Formulario completo (sin factura, tipo editable) — recalcula FIFO/costo. */
function FormularioEdicion({
  detalle,
  productos,
  clientes,
  lotes,
}: {
  detalle: MovimientoDetalle;
  productos: Prod[];
  clientes: Cli[];
  lotes: Lote[];
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoManual>(detalle.tipo as TipoManual);
  const [fecha, setFecha] = useState(detalle.fecha);
  const [clienteId, setClienteId] = useState(detalle.clienteId ?? "");
  const [medioPago, setMedioPago] = useState<MedioPago>((detalle.medioPago as MedioPago) ?? "efectivo");
  const [loteId, setLoteId] = useState("");
  const [obs, setObs] = useState(detalle.observaciones ?? "");
  const [items, setItems] = useState(
    detalle.items.map((i) => ({
      key: i.id,
      productoId: i.productoId,
      cantidad: String(i.cantidad),
      precio: i.precioNeto ?? "",
    })),
  );
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pideMedioPago = tipo === "venta";
  const pidePrecio = tipo === "venta";
  const prodItems = productos.map((p) => ({ label: p.nombre, value: p.id }));

  function guardar() {
    setError(null);
    startSaving(async () => {
      const res = await editarMovimiento(detalle.id, {
        fecha,
        tipo,
        clienteId,
        medioPago: pideMedioPago ? medioPago : null,
        loteId: tipo === "ajuste" ? loteId || null : null,
        observaciones: obs || null,
        items: items.map((i) => ({
          productoId: i.productoId,
          cantidad: Number(i.cantidad || 0),
          precioNeto: pidePrecio ? Number(i.precio || 0) : undefined,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Movimiento actualizado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Tipo</Label>
          <Select
            items={TIPOS_MANUAL.map((t) => ({ label: TIPO_LABEL[t], value: t }))}
            value={tipo}
            onValueChange={(v) => setTipo((v as TipoManual) ?? tipo)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_MANUAL.filter((t) => EDITABLES_CON_RECALCULO.has(t)).map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPO_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Fecha</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        {pideMedioPago ? (
          <div className="grid gap-1.5">
            <Label className="text-xs">Medio de pago</Label>
            <Select
              items={MEDIOS_PAGO.map((m) => ({ label: MEDIO_PAGO_LABEL[m], value: m }))}
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

      <div className="grid gap-1.5 sm:max-w-xs">
        <Label className="text-xs">Cliente / destino</Label>
        <Select
          items={[
            { label: "— sin especificar —", value: "__none__" },
            ...clientes.map((c) => ({ label: c.nombre, value: c.id })),
          ]}
          value={clienteId || "__none__"}
          onValueChange={(v) => setClienteId(!v || v === "__none__" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— sin especificar —</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tipo === "ajuste" ? (
        <div className="grid max-w-xs gap-1.5">
          <Label className="text-xs">Lote (para ajustes que suman stock)</Label>
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
                { key: crypto.randomUUID(), productoId: productos[0]?.id ?? "", cantidad: "1", precio: "" },
              ])
            }
          >
            Agregar ítem
          </Button>
        </div>
        {items.map((it, idx) => (
          <div key={it.key} className="grid gap-2 sm:grid-cols-[1fr_7rem_9rem_auto]">
            <Select
              items={prodItems}
              value={it.productoId || null}
              onValueChange={(v) =>
                setItems((is) => is.map((x) => (x.key === it.key ? { ...x, productoId: v ?? "" } : x)))
              }
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
              value={it.cantidad}
              onChange={(e) =>
                setItems((is) => is.map((x) => (x.key === it.key ? { ...x, cantidad: e.target.value } : x)))
              }
            />
            {pidePrecio ? (
              <Input
                type="number"
                step="any"
                placeholder="Precio neto / u"
                value={it.precio}
                onChange={(e) =>
                  setItems((is) => is.map((x) => (x.key === it.key ? { ...x, precio: e.target.value } : x)))
                }
              />
            ) : (
              <span />
            )}
            {items.length > 1 ? (
              <button
                type="button"
                className="text-xs text-destructive underline"
                onClick={() => setItems((is) => is.filter((x) => x.key !== it.key))}
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button onClick={guardar} disabled={saving}>
        {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}

/** Movimiento facturado, anulado o de consignación: solo medioPago/obs editables. */
function VistaSoloLectura({
  detalle,
  esAdmin,
  puedeEscribir,
  lotes,
}: {
  detalle: MovimientoDetalle;
  esAdmin: boolean;
  puedeEscribir: boolean;
  lotes: Lote[];
}) {
  const router = useRouter();
  const editableLibre = puedeEscribir && detalle.estado !== "anulado";
  const [medioPago, setMedioPago] = useState(detalle.medioPago ?? "");
  const [obs, setObs] = useState(detalle.observaciones ?? "");
  const [saving, startSaving] = useTransition();

  function guardarLibres() {
    startSaving(async () => {
      const res = await editarCamposLibres(detalle.id, { medioPago: medioPago || null, observaciones: obs || null });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Guardado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {!EDITABLES_CON_RECALCULO.has(detalle.tipo) && detalle.estado === "vigente" && !detalle.factura ? (
        <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
          Las consignaciones todavía no se editan desde acá — anulá y cargá de nuevo si hace falta.
        </p>
      ) : null}

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <span className="text-xs text-muted-foreground">Cliente / destino</span>
          <p>{detalle.clienteSnapshot?.nombre ?? detalle.clienteNombre ?? "—"}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Fecha</span>
          <p>{detalle.fecha}</p>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Ítems</span>
        <ul className="divide-y rounded-md border text-sm">
          {detalle.items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span>
                {it.cantidad}× {it.producto}
                {it.precioNeto ? ` · ${fmtMoney(it.precioNeto)}/u` : ""}
              </span>
              {esAdmin && detalle.estado === "vigente" && it.lotes.length === 1 ? (
                <ReasignarLote item={it} lotes={lotes} />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {it.lotes.map((l) => `${l.loteNombre} ×${l.cantidad}`).join(" · ") || "—"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {editableLibre ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {detalle.tipo === "venta" || detalle.tipo === "venta_consignacion" ? (
            <div className="grid gap-1.5">
              <Label className="text-xs">Medio de pago</Label>
              <Select
                items={MEDIOS_PAGO.map((m) => ({ label: MEDIO_PAGO_LABEL[m], value: m }))}
                value={medioPago || null}
                onValueChange={(v) => setMedioPago(v ?? "")}
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
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs">Observaciones</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <Button size="sm" onClick={guardarLibres} disabled={saving} className="w-fit">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ReasignarLote({
  item,
  lotes,
}: {
  item: MovimientoDetalle["items"][number];
  lotes: Lote[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const loteActual = item.lotes[0];

  return (
    <Select
      items={lotes.map((l) => ({ label: l.nombre, value: l.id }))}
      value={loteActual?.loteId ?? null}
      onValueChange={(v) => {
        if (!v || v === loteActual?.loteId) return;
        startTransition(async () => {
          const res = await reasignarLote(item.id, v);
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Lote reasignado.");
            router.refresh();
          }
        });
      }}
    >
      <SelectTrigger className="h-7 w-40 text-xs" disabled={pending}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {lotes.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {l.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Historial({ historial }: { historial: CambioAuditoria[] }) {
  const [abierto, setAbierto] = useState(false);
  if (historial.length === 0) return null;
  return (
    <div className="rounded-lg border p-3 text-sm">
      <button
        type="button"
        className="font-medium underline"
        onClick={() => setAbierto((a) => !a)}
      >
        Historial de cambios ({historial.length}) {abierto ? "▲" : "▼"}
      </button>
      {abierto ? (
        <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
          {historial.map((h) => (
            <li key={h.id}>
              <span className="font-mono">{fmtDateHora(h.createdAt)}</span> — {h.accion}
              {h.datos ? <pre className="mt-0.5 whitespace-pre-wrap">{JSON.stringify(h.datos, null, 0)}</pre> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Registrar como ya facturada fuera del sistema (adenda v1.3 §9.9, admin). */
function FacturaExternaDialog({
  movimientoId,
  onGuardada,
}: {
  movimientoId: string;
  onGuardada: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipoComprobante, setTipoComprobante] = useState<"A" | "B">("B");
  const [puntoVenta, setPuntoVenta] = useState("1");
  const [numero, setNumero] = useState("");
  const [saving, startSaving] = useTransition();

  function guardar() {
    startSaving(async () => {
      const res = await marcarFacturaExterna(movimientoId, {
        tipoComprobante,
        puntoVenta: Number(puntoVenta),
        numero: Number(numero),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Marcada como facturada externamente.");
      setOpen(false);
      onGuardada();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={() => setOpen(true)}
      >
        ¿Ya facturada afuera?
      </button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Factura externa</DialogTitle>
          <DialogDescription>
            Para ventas ya facturadas antes de la integración (sin CAE acá, queda congelada igual).
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select
              items={[{ label: "A", value: "A" }, { label: "B", value: "B" }]}
              value={tipoComprobante}
              onValueChange={(v) => setTipoComprobante((v as "A" | "B") ?? "B")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="B">B</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Punto de venta</Label>
            <Input type="number" value={puntoVenta} onChange={(e) => setPuntoVenta(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Número</Label>
            <Input type="number" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving || !numero}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
