import Link from "next/link";

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
import { TIPO_LABEL } from "@/features/movimientos/schema";
import type { AsientoCC, EntidadTipo } from "@/features/cc/queries";
import { fmtDate, fmtMoney } from "@/lib/format";

import { RegistrarPagoForm } from "./registrar-pago";

export function CCDetalle({
  tercero,
  entidadTipo,
  saldo,
  asientos,
  mediosPago,
  editable,
}: {
  tercero: { id: string; nombre: string; activo: boolean };
  entidadTipo: EntidadTipo;
  saldo: number;
  asientos: AsientoCC[];
  mediosPago: { id: string; nombre: string }[];
  editable: boolean;
}) {
  // Saldo corrido: recorrer de más viejo a más nuevo.
  const corrido: number[] = new Array(asientos.length).fill(0);
  let acc = 0;
  for (let i = asientos.length - 1; i >= 0; i--) {
    acc += Number(asientos[i].debe) - Number(asientos[i].haber);
    corrido[i] = acc;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={entidadTipo === "cliente" ? "/cc-clientes" : "/cc-proveedores"}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← CC {entidadTipo === "cliente" ? "Clientes" : "Proveedores"}
          </Link>
          <h1 className="text-2xl font-semibold">{tercero.nombre}</h1>
          <div className="mt-2 flex gap-1.5">
            {tercero.activo ? (
              <Badge variant="secondary">Activo</Badge>
            ) : (
              <Badge variant="outline">Inactivo</Badge>
            )}
          </div>
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Saldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{fmtMoney(saldo)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {entidadTipo === "cliente"
                ? "Lo que el cliente todavía debe."
                : "Lo que Maitén le debe al proveedor."}
            </p>
          </CardContent>
        </Card>
      </div>

      {editable ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Registrar pago</h2>
          <RegistrarPagoForm
            entidadTipo={entidadTipo}
            entidadId={tercero.id}
            mediosPago={mediosPago}
          />
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asientos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asientos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Sin asientos. Las ventas a crédito y los ingresos a plazo
                      generan asientos automáticos.
                    </TableCell>
                  </TableRow>
                ) : (
                  asientos.map((a, i) => {
                    const debe = Number(a.debe);
                    const haber = Number(a.haber);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs tabular-nums">
                          {fmtDate(a.fecha)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.concepto ?? "—"}
                        </TableCell>
                        <TableCell>
                          {a.movimiento ? (
                            <Link
                              href={`/movimientos/${a.movimiento.id}`}
                              className="text-xs font-medium hover:underline"
                            >
                              {TIPO_LABEL[
                                a.movimiento.tipo as keyof typeof TIPO_LABEL
                              ] ?? a.movimiento.tipo}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Directo
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {debe > 0 ? fmtMoney(debe) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {haber > 0 ? fmtMoney(haber) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {fmtMoney(corrido[i])}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}