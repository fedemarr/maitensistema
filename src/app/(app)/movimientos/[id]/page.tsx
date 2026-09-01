import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMovimiento } from "@/features/movimientos/queries";
import { signoDe, TIPO_LABEL } from "@/features/movimientos/schema";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtMoney } from "@/lib/format";

import { MovimientoAcciones } from "./_acciones";

export const metadata = { title: "Movimiento — Maitén" };

export default async function FichaMovimientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const mov = await getMovimiento(id);
  if (!mov) notFound();

  const tercero =
    mov.tipo === "ingreso"
      ? mov.proveedor?.nombre ?? "—"
      : mov.cliente?.nombre ?? "—";
  const signo = signoDe(mov.tipo);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/movimientos"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Movimientos
          </Link>
          <h1 className="text-2xl font-semibold">
            {TIPO_LABEL[mov.tipo]} — {fmtDate(mov.fecha)}
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {signo === "ajuste" ? (
              <Badge variant="outline">Ajuste</Badge>
            ) : signo === 1 ? (
              <Badge variant="secondary">Entrada</Badge>
            ) : mov.tipo === "venta" ? (
              <Badge>Venta</Badge>
            ) : (
              <Badge variant="destructive">Salida</Badge>
            )}
            {mov.medioPago ? (
              <Badge variant="outline">{mov.medioPago.nombre}</Badge>
            ) : null}
          </div>
        </div>
        {user.rol === "admin" ? (
          <MovimientoAcciones id={mov.id} />
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {fmtMoney(mov.total)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Tercero
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{tercero}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Registrado por
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {mov.creador?.nombre ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {mov.notas ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Notas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{mov.notas}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ítems</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mov.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.variante.producto.nombre}</TableCell>
                    <TableCell>{item.variante.nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.cantidad}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(item.precioUnit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(Number(item.precioUnit) * item.cantidad)}
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
