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
import {
  conciliacionLote,
  listBajas,
  listInsumos,
  listLotes,
} from "@/features/insumos/queries";
import { MOTIVO_LABEL, type MotivoBaja } from "@/features/insumos/schema";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtCantidad, fmtDate, fmtMoney, fmtNumber } from "@/lib/format";

import { InsumosPanel } from "./_components/insumos-panel";

export const metadata = { title: "Insumos — Maitén" };

export default async function InsumosPage({
  searchParams,
}: {
  searchParams: Promise<{ lote?: string }>;
}) {
  const user = await requireUser();
  const editable = puedeEscribir(user.rol);
  const { lote } = await searchParams;

  const [insumos, lotes, bajas] = await Promise.all([
    listInsumos(),
    listLotes(),
    listBajas(),
  ]);

  const loteId = lote ?? lotes[lotes.length - 1]?.id ?? "";
  const conc = loteId ? await conciliacionLote(loteId) : [];
  const loteNombre = lotes.find((l) => l.id === loteId)?.nombre ?? "—";

  const activos = insumos.filter((i) => i.activo).length;
  const reut = insumos.filter((i) => i.reutilizable && i.activo).length;
  const valorStock = insumos.reduce((a, i) => a + i.valorStock, 0);
  const perdidaLote = conc.reduce((a, c) => a + c.perdida, 0);
  const compradoKg = conc
    .filter((c) => c.unidad === "kg")
    .reduce((a, c) => a + c.comprado, 0);
  const consumidoKg = conc
    .filter((c) => c.unidad === "kg")
    .reduce((a, c) => a + Math.min(c.consumido, c.comprado), 0);
  const aprovechamiento =
    compradoKg > 0 ? Math.round((consumidoKg / compradoKg) * 100) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Insumos</h1>
        <p className="text-sm text-muted-foreground">
          Materia prima y envases. El costo (PPP) sale de las compras.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="gap-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-[11px] uppercase text-muted-foreground">
              Insumos activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activos}</p>
            <p className="text-xs text-muted-foreground">
              {reut} reutilizables · {activos - reut} no
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-[11px] uppercase text-muted-foreground">
              Valor del stock (PPP)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmtMoney(valorStock)}</p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-[11px] uppercase text-muted-foreground">
              Aprovechamiento · {loteNombre}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {aprovechamiento != null ? `${aprovechamiento} %` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              $ consumido / $ comprado
            </p>
          </CardContent>
        </Card>
        <Card className="gap-1">
          <CardHeader className="pb-0">
            <CardTitle className="text-[11px] uppercase text-muted-foreground">
              Pérdida sobrantes · {loteNombre}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {fmtMoney(perdidaLote)}
            </p>
          </CardContent>
        </Card>
      </div>

      <InsumosPanel insumos={insumos} editable={editable} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Conciliación por lote
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              comprado vs. consumido
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {lotes.map((l) => (
              <Link
                key={l.id}
                href={`/insumos?lote=${l.id}`}
                className={`rounded-md border px-2 py-1 text-xs ${
                  l.id === loteId
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                {l.nombre}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Comprado</TableHead>
                  <TableHead className="text-right">Consumido</TableHead>
                  <TableHead className="text-right">Sobrante</TableHead>
                  <TableHead>Reutilizable</TableHead>
                  <TableHead className="text-right">Pérdida $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conc.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Este lote todavía no tiene compras ni consumos.
                    </TableCell>
                  </TableRow>
                ) : (
                  conc.map((c) => (
                    <TableRow key={c.insumoId}>
                      <TableCell className="font-medium">{c.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtCantidad(c.comprado, c.unidad)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtCantidad(c.consumido, c.unidad)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.sobrante > 0
                          ? fmtCantidad(c.sobrante, c.unidad)
                          : c.sobrante < 0
                            ? "usó stock previo"
                            : "—"}
                      </TableCell>
                      <TableCell>{c.reutilizable ? "Sí" : "No"}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        {c.perdida > 0 ? fmtMoney(c.perdida) : "—"}
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
          <CardTitle className="text-base">Bajas registradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead className="text-right">Pérdida $</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bajas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Sin bajas registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  bajas.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{fmtDate(b.fecha)}</TableCell>
                      <TableCell className="font-medium">{b.insumo}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(
                          Number(b.cantidad),
                          b.unidad === "kg" ? 3 : 0,
                        )}{" "}
                        {b.unidad}
                      </TableCell>
                      <TableCell>
                        {MOTIVO_LABEL[b.motivo as MotivoBaja]}
                        {b.automatica ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            auto
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.lote ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        {fmtMoney(b.monto)}
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
