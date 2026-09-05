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
import { IVA, type TipoLista } from "@/features/precios/schema";
import { fmtDate, fmtMoney } from "@/lib/format";

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const conIva = (neto: number) => fmtMoney(Math.round(neto * IVA));

function CeldaPrecio({
  productoId,
  tipoLista,
  vigente,
  editable,
}: {
  productoId: string;
  tipoLista: TipoLista;
  vigente: { precioNeto: string; vigenteDesde: string } | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(
    vigente ? String(Number(vigente.precioNeto)) : "",
  );
  const [pending, startTransition] = useTransition();
  const neto = Number(valor || 0);
  const cambio = vigente
    ? Number(vigente.precioNeto) !== neto
    : neto > 0;

  function guardar() {
    startTransition(async () => {
      const res = await guardarPrecio({
        productoId,
        tipoLista,
        precioNeto: neto,
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
          {vigente ? fmtMoney(vigente.precioNeto) : "—"}
        </p>
        {vigente ? (
          <p className="text-[11px] text-muted-foreground">
            con IVA {conIva(Number(vigente.precioNeto))} · desde{" "}
            {fmtDate(vigente.vigenteDesde)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          step="any"
          className="h-8 w-28"
          placeholder="neto"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2"
          disabled={pending || !cambio}
          onClick={guardar}
        >
          Guardar
        </Button>
      </div>
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {neto > 0 ? `con IVA ${conIva(neto)}` : "—"}
      </p>
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
            <TableHead>Retail (neto)</TableHead>
            <TableHead>Mayorista (neto)</TableHead>
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
                  {p.mayorista ? (
                    <CeldaPrecio
                      productoId={p.productoId}
                      tipoLista="mayorista"
                      vigente={p.mayorista}
                      editable={editable}
                    />
                  ) : (
                    <div className="space-y-1">
                      {editable ? (
                        <CeldaPrecio
                          productoId={p.productoId}
                          tipoLista="mayorista"
                          vigente={null}
                          editable={editable}
                        />
                      ) : null}
                      <p className="text-[11px] text-muted-foreground">
                        vacío = usa retail
                      </p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
