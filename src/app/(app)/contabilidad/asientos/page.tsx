import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAsientos } from "@/features/contabilidad/queries";
import { ORIGEN_ASIENTO_LABEL } from "@/features/contabilidad/schema";
import { fmtDate, fmtMoney } from "@/lib/format";

export const metadata = { title: "Asientos — Maitén" };

export default async function AsientosPage() {
  const asientos = await listAsientos();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Asientos</h1>
        <p className="text-sm text-muted-foreground">
          Diario contable automático. Cada movimiento genera su asiento al
          confirmarse; cada pago de CC genera el suyo.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asientos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Todavía no hay asientos. Cargá un movimiento y aparecerá acá.
                    </TableCell>
                  </TableRow>
                ) : (
                  asientos.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="tabular-nums">
                        {fmtDate(a.fecha)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {a.descripcion}
                      </TableCell>
                      <TableCell>
                        {ORIGEN_ASIENTO_LABEL[a.origen] ?? a.origen}
                      </TableCell>
                      <TableCell>
                        {a.balanced ? (
                          <Badge variant="secondary">Balanceado</Badge>
                        ) : (
                          <Badge variant="destructive">Descuadre</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.totalDebe ? fmtMoney(a.totalDebe) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.totalHaber ? fmtMoney(a.totalHaber) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" render={<Link href={`/contabilidad/asientos/${a.id}`} />}>
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}