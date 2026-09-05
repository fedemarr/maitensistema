import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAsiento } from "@/features/finanzas/queries";
import { ORIGEN_ASIENTO_LABEL } from "@/features/finanzas/schema";
import { TIPO_LABEL } from "@/features/movimientos/schema";
import { fmtDate, fmtMoney } from "@/lib/format";

export const metadata = { title: "Asiento — Maitén" };

export default async function AsientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await getAsiento(id);
  if (!a) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/finanzas/asientos"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Libro diario
          </Link>
          <h1 className="text-2xl font-semibold">{a.descripcion}</h1>
          <p className="text-sm text-muted-foreground">
            {fmtDate(a.fecha)} · {ORIGEN_ASIENTO_LABEL[a.origen] ?? a.origen} ·
            Asiento {a.id.slice(0, 8)}
          </p>
        </div>
        {a.balanced ? (
          <Badge variant="secondary">Balanceado</Badge>
        ) : (
          <Badge variant="destructive">Descuadre</Badge>
        )}
      </div>

      {a.movimiento ? (
        <p className="text-sm text-muted-foreground">
          Generado por el movimiento{" "}
          <span className="font-mono">{a.movimiento.id.slice(0, 8)}</span> (
          {TIPO_LABEL[a.movimiento.tipo as keyof typeof TIPO_LABEL] ??
            a.movimiento.tipo}
          {a.movimiento.observaciones ? ` — ${a.movimiento.observaciones}` : ""}).
        </p>
      ) : a.compra ? (
        <p className="text-sm text-muted-foreground">
          Generado por la compra de insumos{" "}
          <span className="font-mono">{a.compra.id.slice(0, 8)}</span> del{" "}
          {fmtDate(a.compra.fecha)} por {fmtMoney(a.compra.total)}.
        </p>
      ) : a.orden ? (
        <p className="text-sm text-muted-foreground">
          Generado por la orden de producción{" "}
          <span className="font-mono">{a.orden.id.slice(0, 8)}</span>.
        </p>
      ) : a.ccMovimiento ? (
        <p className="text-sm text-muted-foreground">
          Generado por un movimiento de cuenta corriente ({a.ccMovimiento.concepto}).
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Asiento manual (sin hecho asociado).
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.lineas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Sin líneas.
                    </TableCell>
                  </TableRow>
                ) : (
                  a.lineas.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        <span className="font-mono text-xs text-muted-foreground">
                          {l.cuenta?.codigo}
                        </span>{" "}
                        {l.cuenta?.nombre}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {l.concepto ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(l.debe) ? fmtMoney(l.debe) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(l.haber) ? fmtMoney(l.haber) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
        <p className="tabular-nums">
          Débitos totales: <strong>{fmtMoney(a.totalDebe)}</strong>
        </p>
        <p className="tabular-nums">
          Créditos totales: <strong>{fmtMoney(a.totalHaber)}</strong>
        </p>
        {a.creador ? (
          <p className="text-muted-foreground">
            Registrado por {a.creador.nombre}
          </p>
        ) : null}
      </div>
    </div>
  );
}
