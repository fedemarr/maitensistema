import Link from "next/link";

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
import { getReporte } from "@/features/reportes/queries";
import { TIPO_LABEL } from "@/features/movimientos/schema";
import { CATEGORIA_LABEL } from "@/features/costos-fijos/schema";
import type { CategoriaCostoFijo } from "@/features/costos-fijos/schema";
import { requireUser } from "@/lib/auth";
import { fmtMoney, fmtNumber } from "@/lib/format";

export const metadata = { title: "Reportes — Maitén" };

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const mesLargo = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1]} de ${y}`;
};
const mesCorto = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1].slice(0, 3)}-${String(y).slice(2)}`;
};
const pct = (v: number | null) =>
  v == null ? "—" : `${(v * 100).toFixed(1)} %`;

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireUser();
  const { mes } = await searchParams;
  const r = await getReporte(mes);
  const actual = r.meses.find((m) => m.mes === r.mesActual) ?? r.meses[0];

  const total = r.meses.reduce(
    (a, m) => ({
      unidades: a.unidades + m.unidades,
      ingresos: a.ingresos + m.ingresos,
      cmv: a.cmv + m.cmv,
      bruto: a.bruto + m.bruto,
      desvios: a.desvios + m.desvios,
      coBranding: a.coBranding + m.coBranding,
      salidasNoVenta: a.salidasNoVenta + m.salidasNoVenta,
      perdidaInsumos: a.perdidaInsumos + m.perdidaInsumos,
      antesCostosFijos: a.antesCostosFijos + m.antesCostosFijos,
      costosFijos: a.costosFijos + m.costosFijos,
      ebit: a.ebit + m.ebit,
    }),
    {
      unidades: 0, ingresos: 0, cmv: 0, bruto: 0, desvios: 0,
      coBranding: 0, salidasNoVenta: 0, perdidaInsumos: 0, antesCostosFijos: 0,
      costosFijos: 0, ebit: 0,
    },
  );

  const tipoOrden = [
    "produccion", "venta", "venta_consignacion", "consignacion",
    "devolucion_consignacion", "canje", "presentacion", "regalo", "rotura",
    "sorteo", "tester", "co_branding", "influencer", "prueba", "ajuste",
  ];
  const porTipo = [...r.porTipo].sort(
    (a, b) => tipoOrden.indexOf(a.tipo) - tipoOrden.indexOf(b.tipo),
  );

  const kpis = [
    {
      k: "Unidades vendidas",
      v: fmtNumber(actual.unidades),
      d: "Venta + venta desde consignación",
    },
    { k: "Ingresos", v: fmtMoney(actual.ingresos), d: "Netos de IVA" },
    { k: "CMV", v: fmtMoney(actual.cmv), d: "Al costo promedio (PPP)" },
    {
      k: "Resultado bruto",
      v: fmtMoney(actual.bruto),
      d: actual.margen != null ? `${pct(actual.margen)} de margen` : "—",
    },
  ];

  const cascada: [string, number, boolean?][] = [
    ["Resultado bruto", actual.bruto, true],
    ["− Costos de canal (pendiente)", 0],
    ["± Desvíos de producción", actual.desvios],
    ["− Co-branding (a costo)", -actual.coBranding],
    ["− Salidas no-venta a costo", -actual.salidasNoVenta],
    ["− Pérdida por insumos", -actual.perdidaInsumos],
    ["RESULTADO ANTES DE COSTOS FIJOS", actual.antesCostosFijos, true],
    ["− Costos fijos del mes", -actual.costosFijos],
    ["RESULTADO (EBIT)", actual.ebit, true],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reporte económico</h1>
          <p className="text-sm capitalize text-muted-foreground">
            {mesLargo(r.mesActual)} · resultado (EBIT): {fmtMoney(actual.ebit)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {r.meses.map((m) => (
            <Link
              key={m.mes}
              href={`/reportes?mes=${m.mes}`}
              className={`rounded-md border px-2 py-1 text-xs ${
                m.mes === r.mesActual
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              {mesCorto(m.mes)}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((t) => (
          <Card key={t.k} className="gap-1">
            <CardHeader className="pb-0">
              <CardTitle className="text-[11px] uppercase text-muted-foreground">
                {t.k}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{t.v}</p>
              <p className="text-xs text-muted-foreground">{t.d}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por producto</CardTitle>
          <p className="text-xs text-muted-foreground">
            Meses de stock = stock ÷ unidades vendidas · % consumido = vendidas
            ÷ (vendidas + stock)
          </p>
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
                {r.porProducto.map((p) => (
                  <TableRow key={p.producto}>
                    <TableCell className="font-medium">{p.producto}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNumber(p.unidades)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(p.ingresos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(p.cmv)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(p.bruto)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(p.margen)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNumber(p.stock)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.mesesStock != null
                        ? p.mesesStock.toFixed(1)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {pct(p.pctConsumido)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Desglose por tipo de movimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Unidades</TableHead>
                    <TableHead className="text-right">
                      Valorizado a costo
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porTipo.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        Sin movimientos en el período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    porTipo.map((t) => (
                      <TableRow key={t.tipo}>
                        <TableCell>
                          {TIPO_LABEL[t.tipo as keyof typeof TIPO_LABEL] ??
                            t.tipo}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtNumber(t.unidades)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {t.valorCosto ? fmtMoney(t.valorCosto) : "—"}
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
            <CardTitle className="text-base">Del bruto al EBIT</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {cascada.map(([label, val, fuerte]) => (
                  <TableRow key={label}>
                    <TableCell className={fuerte ? "font-bold" : ""}>
                      {label}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        fuerte ? "font-bold" : ""
                      }`}
                    >
                      {fmtMoney(val)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {r.costosFijosPorCategoria.length > 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                Costos fijos del mes por categoría:{" "}
                {r.costosFijosPorCategoria
                  .map(
                    (c) =>
                      `${CATEGORIA_LABEL[c.categoria as CategoriaCostoFijo] ?? c.categoria} ${fmtMoney(c.monto)}`,
                  )
                  .join(" · ")}
                .
              </p>
            ) : (
              <p className="p-3 text-xs text-muted-foreground">
                Sin costos fijos cargados para este mes. Cargalos en{" "}
                <Link href="/costos-fijos" className="underline">
                  Costos fijos
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolución mensual</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  {r.meses.map((m) => (
                    <TableHead key={m.mes} className="text-right">
                      {mesCorto(m.mes)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    ["Unidades vendidas", (m) => fmtNumber(m.unidades), total.unidades && fmtNumber(total.unidades)],
                    ["Ingresos", (m) => fmtMoney(m.ingresos), fmtMoney(total.ingresos)],
                    ["CMV", (m) => fmtMoney(m.cmv), fmtMoney(total.cmv)],
                    ["Resultado bruto", (m) => fmtMoney(m.bruto), fmtMoney(total.bruto)],
                    ["± Desvíos producción", (m) => fmtMoney(m.desvios), fmtMoney(total.desvios)],
                    ["− Co-branding", (m) => fmtMoney(-m.coBranding), fmtMoney(-total.coBranding)],
                    ["− Salidas no-venta", (m) => fmtMoney(-m.salidasNoVenta), fmtMoney(-total.salidasNoVenta)],
                    ["− Pérdida insumos", (m) => fmtMoney(-m.perdidaInsumos), fmtMoney(-total.perdidaInsumos)],
                    ["ANTES DE COSTOS FIJOS", (m) => fmtMoney(m.antesCostosFijos), fmtMoney(total.antesCostosFijos)],
                    ["− Costos fijos", (m) => fmtMoney(-m.costosFijos), fmtMoney(-total.costosFijos)],
                    ["EBIT", (m) => fmtMoney(m.ebit), fmtMoney(total.ebit)],
                  ] as [string, (m: (typeof r.meses)[number]) => string, string | number][]
                ).map(([label, fn, tot], i, arr) => (
                  <TableRow key={label}>
                    <TableCell
                      className={i === arr.length - 1 ? "font-bold" : ""}
                    >
                      {label}
                    </TableCell>
                    {r.meses.map((m) => (
                      <TableCell
                        key={m.mes}
                        className={`text-right tabular-nums ${
                          i === arr.length - 1 ? "font-bold" : ""
                        }`}
                      >
                        {fn(m)}
                      </TableCell>
                    ))}
                    <TableCell
                      className={`text-right tabular-nums ${
                        i === arr.length - 1 ? "font-bold" : "font-medium"
                      }`}
                    >
                      {tot || "—"}
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
