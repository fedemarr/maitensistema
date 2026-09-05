import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { estadoResultados } from "@/features/finanzas/queries";
import { fmtMoney } from "@/lib/format";

export const metadata = { title: "Resultados — Maitén" };

function mesDefault(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Último día del mes (YYYY-MM). */
function ultimoDia(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const dias = new Date(y, m, 0).getDate();
  return `${mes}-${String(dias).padStart(2, "0")}`;
}

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams?: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  const mes =
    typeof sp?.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes)
      ? sp.mes
      : mesDefault();
  const desde = `${mes}-01`;
  const hasta = ultimoDia(mes);
  const r = await estadoResultados(desde, hasta);

  const [año, mesNum] = mes.split("-");
  const mesNombre = new Date(
    Number(año),
    Number(mesNum) - 1,
    1,
  ).toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Estado de resultados</h1>
          <p className="text-sm capitalize text-muted-foreground">{mesNombre}</p>
        </div>
        <form method="get">
          <input
            type="month"
            name="mes"
            defaultValue={mes}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          />
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile titulo="Ingresos" valor={fmtMoney(r.ingresos)} />
        <Tile titulo="Gastos" valor={fmtMoney(r.gastos)} neg />
        <Tile
          titulo="Resultado del mes"
          valor={fmtMoney(r.resultado)}
          neg={r.resultado < 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por cuenta contable</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Debe</TableHead>
                  <TableHead className="text-right">Haber</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.cuentas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Sin asientos en el período.
                    </TableCell>
                  </TableRow>
                ) : (
                  r.cuentas.map((c) => (
                    <TableRow key={c.cuentaId}>
                      <TableCell className="font-medium">
                        <span className="font-mono text-xs text-muted-foreground">
                          {c.codigo}
                        </span>{" "}
                        {c.nombre}
                      </TableCell>
                      <TableCell>
                        {c.tipo === "rpos" ? "Ingreso" : "Gasto"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.debe ? fmtMoney(c.debe) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.haber ? fmtMoney(c.haber) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {c.neto !== 0 ? fmtMoney(c.neto) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Los asientos se generan automáticamente con cada movimiento. Los ajustes
        de stock (altas y correcciones) no entran a los libros.
      </p>
    </div>
  );
}

function Tile({
  titulo,
  valor,
  neg,
}: {
  titulo: string;
  valor: string;
  neg?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`text-2xl font-semibold tabular-nums ${
            neg ? "text-destructive" : ""
          }`}
        >
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}