"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { reenviarFactura } from "@/features/afip/actions";
import { FacturarDialog } from "@/features/afip/_components/facturar-dialog";
import type { MovimientoRow } from "@/features/movimientos/queries";
import { TIPO_LABEL } from "@/features/movimientos/schema";
import { fmtDate, fmtDateHora, fmtMoney, fmtNumber } from "@/lib/format";

const ENTRA = new Set(["produccion", "devolucion_consignacion"]);
const FACTURABLE = new Set(["venta", "venta_consignacion"]);
const ESTADO_LABEL: Record<string, string> = {
  anulado: "Anulado",
  con_nc_total: "Con NC",
};

export function MovimientosHistorial({ rows }: { rows: MovimientoRow[] }) {
  const router = useRouter();
  const [tipo, setTipo] = useState("todos");
  const [prod, setProd] = useState("todos");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function reenviar(facturaId: string) {
    setPendingId(facturaId);
    startTransition(async () => {
      const res = await reenviarFactura(facturaId);
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else toast.success("Factura reenviada por mail.");
      router.refresh();
    });
  }

  const productos = useMemo(
    () => [...new Set(rows.map((r) => r.producto))].sort(),
    [rows],
  );

  const filtrados = rows.filter((r) => {
    if (tipo !== "todos" && r.tipo !== tipo) return false;
    if (prod !== "todos" && r.producto !== prod) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select
          items={[
            { label: "Todos los tipos", value: "todos" },
            ...Object.entries(TIPO_LABEL).map(([v, l]) => ({
              label: l,
              value: v,
            })),
          ]}
          value={tipo}
          onValueChange={(v) => setTipo(v ?? "todos")}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {Object.entries(TIPO_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={[
            { label: "Todos los productos", value: "todos" },
            ...productos.map((p) => ({ label: p, value: p })),
          ]}
          value={prod}
          onValueChange={(v) => setProd(v ?? "todos")}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los productos</SelectItem>
            {productos.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cliente / destino</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead className="text-right">Ingreso</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead>Comprobante</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Sin movimientos.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((r) => {
                const entra = ENTRA.has(r.tipo);
                const neutro =
                  r.tipo === "consignacion" ||
                  r.tipo === "devolucion_consignacion";
                const anulado = r.estado !== "vigente";
                return (
                  <TableRow key={r.itemId} className={anulado ? "opacity-60" : undefined}>
                    <TableCell className={anulado ? "line-through" : undefined}>
                      {fmtDate(r.fecha)}
                    </TableCell>
                    <TableCell className={`font-medium ${anulado ? "line-through" : ""}`}>
                      {r.producto}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary">{TIPO_LABEL[r.tipo] ?? r.tipo}</Badge>
                        {anulado ? (
                          <Badge variant="outline" className="text-[10px] text-destructive">
                            {ESTADO_LABEL[r.estado] ?? r.estado}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.cliente ?? "—"}
                      {r.medioPago ? (
                        <span className="block text-[11px]">{r.medioPago}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.lotes}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          neutro
                            ? "text-muted-foreground"
                            : entra
                              ? "text-[var(--color-chart-1)]"
                              : "text-destructive"
                        }
                      >
                        {entra ? "+" : r.cantidad < 0 ? "" : "−"}
                        {fmtNumber(Math.abs(r.cantidad))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.ingresoNeto) ? fmtMoney(r.ingresoNeto) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(r.costo) ? fmtMoney(r.costo) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.facturaId ? (
                        <div className="flex flex-col gap-1">
                          <a href={`/api/facturas/${r.facturaId}/pdf`} className="inline-block">
                            <Badge
                              variant="outline"
                              className="font-mono text-[11px] hover:bg-muted"
                            >
                              {r.facturaTipo}{" "}
                              {String(r.facturaPuntoVenta).padStart(5, "0")}-
                              {String(r.facturaNumero).padStart(8, "0")} ↓
                            </Badge>
                          </a>
                          <EstadoEnvio
                            r={r}
                            pending={pendingId === r.facturaId}
                            onReenviar={() => reenviar(r.facturaId!)}
                          />
                        </div>
                      ) : FACTURABLE.has(r.tipo) && !anulado ? (
                        <FacturarDialog
                          movimientoId={r.movimientoId}
                          onEmitida={() => router.refresh()}
                          trigger={
                            <Button size="sm" variant="outline">
                              Facturar
                            </Button>
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/movimientos/${r.movimientoId}`}
                        prefetch={false}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Ver
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Estado de envío del comprobante, siempre visible (adenda v1.3 §9.2). */
function EstadoEnvio({
  r,
  pending,
  onReenviar,
}: {
  r: MovimientoRow;
  pending: boolean;
  onReenviar: () => void;
}) {
  if (r.facturaEnviada) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">
          Enviada{r.facturaEnviadoA ? ` · ${r.facturaEnviadoA}` : ""}
          {r.facturaEnviadaEn ? ` · ${fmtDateHora(r.facturaEnviadaEn)}` : ""}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 px-1 text-[10px]"
          disabled={pending}
          onClick={onReenviar}
        >
          {pending ? "…" : "reenviar"}
        </Button>
      </div>
    );
  }
  if (r.facturaEnvioError?.includes("no tiene email")) {
    return (
      <span className="text-[11px] text-destructive">
        Sin mail ·{" "}
        <a href={`/clientes`} className="underline">
          cargar en Clientes
        </a>
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-6 px-1.5 text-[11px] text-destructive"
      disabled={pending}
      onClick={onReenviar}
      title={r.facturaEnvioError ?? undefined}
    >
      {pending ? "Enviando…" : "Error de envío · reintentar"}
    </Button>
  );
}
