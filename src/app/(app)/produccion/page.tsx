import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listOrdenes } from "@/features/produccion/queries";
import { ESTADO_ORDEN_LABEL, type EstadoOrden } from "@/features/produccion/schema";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtDate, fmtNumber } from "@/lib/format";

export const metadata = { title: "Producción — Maitén" };

const BADGE: Record<EstadoOrden, "secondary" | "outline"> = {
  borrador: "outline",
  en_proceso: "outline",
  completada: "secondary",
  anulada: "outline",
};

export default async function ProduccionPage() {
  const user = await requireUser();
  const ordenes = await listOrdenes();
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Producción</h1>
          <p className="text-sm text-muted-foreground">
            Órdenes de fabricación. Consumen insumos según la receta y dan de
            alta el producto terminado.
          </p>
        </div>
        {editable ? (
          <Button render={<Link href="/produccion/nueva" />}>Nueva orden</Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creó</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Todavía no hay órdenes de producción.
                </TableCell>
              </TableRow>
            ) : (
              ordenes.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{fmtDate(o.fecha)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/produccion/${o.id}`}
                      className="font-medium hover:underline"
                    >
                      {o.terminadoLabel}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNumber(o.cantidad)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={BADGE[o.estado]}>
                      {ESTADO_ORDEN_LABEL[o.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell>{o.creador ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
