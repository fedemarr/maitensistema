import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TIPO_LABEL } from "@/features/movimientos/schema";
import { reporteMensual } from "@/features/reportes/queries";
import { fmtMoney, fmtNumber } from "@/lib/format";

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

export const metadata = { title: "Reportes — Maitén" };

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  const mes =
    typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : mesDefault();
  const desde = `${mes}-01`;
  const hasta = ultimoDia(mes);

  const r = await reporteMensual(desde, hasta);

  const [año, mesNum] = mes.split("-");
  const mesNombre = new Date(
    Number(año),
    Number(mesNum) - 1,
    1,
  ).toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reporte económico</h1>
          <p className="text-sm capitalize text-muted-foreground">{mesNombre}</p>
        </div>
        <form method="get">
          <div className="flex gap-2">
            <input
              type="month"
              name="mes"
              defaultValue={mes}
              max={mesDefault()}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile titulo="Unidades vendidas" valor={fmtNumber(r.totalUnidades)} />
        <Tile titulo="Ingresos" valor={fmtMoney(r.totalIngresos)} />
        <Tile titulo="CMV" valor={fmtMoney(r.totalCmv)} />
        <Tile titulo="Resultado bruto" valor={fmtMoney(r.totalBruto)} detalle={r.totalMargen !== null ? `Margen ${r.totalMargen.toFixed(1)}%` : "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por producto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Unid.</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">CMV</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Meses stock</TableHead>
                  <TableHead className="text-right">% consumido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.productos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Sin movimientos en el período.
                    </TableCell>
                  </TableRow>
                ) : (
                  r.productos.map((p) => (
                    <TableRow key={p.productoId}>
                      <TableCell className="font-medium">
                        {p.productoNombre}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(p.unidadesVendidas)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(p.ingresos)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(p.cmv)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(p.resultadoBruto)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.margen !== null ? `${p.margen.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(p.stockActual)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.mesesStock !== null
                          ? `${p.mesesStock.toFixed(1)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.pctConsumido !== null
                          ? `${p.pctConsumido.toFixed(0)}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desglose por tipo de movimiento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Valorizado a costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.desglose.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Sin movimientos en el período.
                    </TableCell>
                  </TableRow>
                ) : (
                  r.desglose.map((d) => (
                    <TableRow key={d.tipo}>
                      <TableCell className="font-medium">
                        {TIPO_LABEL[d.tipo]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(d.unidades)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(d.valorCosto)}
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

function Tile({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{valor}</p>
        {detalle ? (
          <p className="text-xs text-muted-foreground">{detalle}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}