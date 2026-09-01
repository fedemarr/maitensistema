import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TerceroConSaldo } from "@/features/cc/queries";
import { fmtMoney } from "@/lib/format";

export function TercerosCCTable({
  terceros,
  baseHref,
}: {
  terceros: TerceroConSaldo[];
  baseHref: string;
}) {
  const total = terceros.reduce((acc, t) => acc + t.saldo, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          Total: {fmtMoney(total)}
        </Badge>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {terceros.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Todavía no hay terceros.
                </TableCell>
              </TableRow>
            ) : (
              terceros.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link
                      href={`${baseHref}/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.nombre}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {t.activo ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${
                      t.saldo < 0 ? "text-muted-foreground" : ""
                    }`}
                  >
                    {fmtMoney(t.saldo)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}