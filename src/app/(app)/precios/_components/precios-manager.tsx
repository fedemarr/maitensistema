"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { guardarPrecio } from "@/features/precios/actions";
import type { ProductoConPrecios } from "@/features/precios/queries";
import { TIPOS_LISTA, TIPO_LISTA_LABEL, type TipoLista } from "@/features/precios/schema";
import { fmtDate, fmtMoney } from "@/lib/format";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function CeldaPrecio({
  productoId,
  tipoLista,
  vigente,
  editable,
}: {
  productoId: string;
  tipoLista: TipoLista;
  vigente: { precioConIva: string; vigenteDesde: string } | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(
    vigente ? String(Number(vigente.precioConIva)) : "",
  );
  const [pending, startTransition] = useTransition();
  const cambio = vigente ? Number(vigente.precioConIva) !== Number(valor || 0) : Number(valor || 0) > 0;

  function guardar() {
    startTransition(async () => {
      const res = await guardarPrecio({
        productoId,
        tipoLista,
        precioConIva: Number(valor || 0),
        vigenteDesde: hoy(),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Precio actualizado.");
      router.refresh();
    });
  }

  if (!editable) {
    return (
      <div>
        <p className="font-medium tabular-nums">
          {vigente ? fmtMoney(vigente.precioConIva) : "—"}
        </p>
        {vigente ? (
          <p className="text-[11px] text-muted-foreground">
            desde {fmtDate(vigente.vigenteDesde)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        step="any"
        className="h-8 w-28"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2"
        disabled={pending || !cambio || !valor}
        onClick={guardar}
      >
        Guardar
      </Button>
    </div>
  );
}

export function PreciosManager({
  productos,
  editable,
}: {
  productos: ProductoConPrecios[];
  editable: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            {TIPOS_LISTA.map((t) => (
              <TableHead key={t}>{TIPO_LISTA_LABEL[t]}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {productos.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No hay productos terminados cargados.
              </TableCell>
            </TableRow>
          ) : (
            productos.map((p) => (
              <TableRow key={p.productoId}>
                <TableCell className="font-medium">{p.nombre}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.sku}
                </TableCell>
                <TableCell>
                  <CeldaPrecio
                    productoId={p.productoId}
                    tipoLista="retail"
                    vigente={p.retail}
                    editable={editable}
                  />
                </TableCell>
                <TableCell>
                  <CeldaPrecio
                    productoId={p.productoId}
                    tipoLista="mayorista"
                    vigente={p.mayorista}
                    editable={editable}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
