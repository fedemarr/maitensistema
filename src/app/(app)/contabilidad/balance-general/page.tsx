import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { balanceComprobacion } from "@/features/contabilidad/queries";
import {
  TIPO_CUENTA,
  TIPO_CUENTA_LABEL,
  type TipoCuenta,
} from "@/features/contabilidad/schema";
import { fmtMoney } from "@/lib/format";

export const metadata = { title: "Balance general — Maitén" };

const TIPO_ORDEN: Record<TipoCuenta, number> = {
  activo: 0,
  pasivo: 1,
  pn: 2,
  rpos: 3,
  rneg: 4,
};

export default async function BalanceGeneralPage() {
  const b = await balanceComprobacion();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Balance general</h1>
        <p className="text-sm text-muted-foreground">
          Saldos acumulados por cuenta. El balance cuadra cuando el total
          deudor es igual al total acreedor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TIPO_CUENTA.map((t) => (
          <Card key={t}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                {TIPO_CUENTA_LABEL[t]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tabular-nums">
                {fmtMoney(b.porTipo[t])}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {b.descuadre ? (
        <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          ¡El balance no cuadra! Debe {fmtMoney(b.totalDebe)} vs haber{" "}
          {fmtMoney(b.totalHaber)}. Revisá los asientos.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Balance de comprobación</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Debe</TableHead>
                  <TableHead>Haber</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {b.porCuenta.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Todavía no hay cuentas cargadas.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...b.porCuenta]
                    .sort((a, z) => TIPO_ORDEN[a.tipo] - TIPO_ORDEN[z.tipo] || a.codigo.localeCompare(z.codigo))
                    .map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.codigo}
                          </span>{" "}
                          <span className="font-medium">{c.nombre}</span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            · {c.rubro}
                          </span>
                          {!c.activo ? (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              (inactiva)
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {c.totalDebe ? fmtMoney(c.totalDebe) : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {c.totalHaber ? fmtMoney(c.totalHaber) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {c.saldo !== 0 ? fmtMoney(c.saldo) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div
        id="totales"
        className="flex flex-wrap justify-between gap-3 rounded-lg border px-4 py-3 text-sm"
      >
        <p className="tabular-nums">
          Totales · Debe <strong>{fmtMoney(b.totalDebe)}</strong>
        </p>
        <p className="tabular-nums">
          Haber <strong>{fmtMoney(b.totalHaber)}</strong>
        </p>
        <p className="tabular-nums">
          Diferencia{" "}
          <strong>{fmtMoney(Math.abs(b.totalDebe - b.totalHaber))}</strong>
        </p>
      </div>
    </div>
  );
}