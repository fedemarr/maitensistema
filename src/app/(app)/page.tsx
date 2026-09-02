import {
  AlertTriangleIcon,
  ArrowLeftRightIcon,
  FactoryIcon,
  PackagePlusIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  listClientesConSaldo,
  listProveedoresConSaldo,
} from "@/features/cc/queries";
import { listMovimientos } from "@/features/movimientos/queries";
import { TIPO_LABEL } from "@/features/movimientos/schema";
import { listOrdenes } from "@/features/produccion/queries";
import { reporteMensual } from "@/features/reportes/queries";
import { listStock } from "@/features/stock/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";

export const metadata = { title: "Inicio — Maitén" };

function mesActual() {
  const now = new Date();
  const desde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const hasta = now.toISOString().slice(0, 10);
  const nombre = now.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  return { desde, hasta, nombre };
}

function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-[var(--color-chart-1)]"
      : tone === "bad"
        ? "text-destructive"
        : tone === "warn"
          ? "text-[var(--color-chart-2)]"
          : "text-foreground";
  return (
    <Card className="gap-2">
      <CardHeader className="pb-0">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
        {sub ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const editable = puedeEscribir(user.rol);
  const { desde, hasta, nombre } = mesActual();

  const [reporte, stock, clientes, proveedores, movs, ordenes] =
    await Promise.all([
      reporteMensual(desde, hasta),
      listStock(),
      listClientesConSaldo(),
      listProveedoresConSaldo(),
      listMovimientos({}),
      listOrdenes(),
    ]);

  const criticas = stock.filter((f) => f.estado !== "ok");
  const valorInventario = stock.reduce((a, f) => a + f.valorCosto, 0);
  const porCobrar = clientes.reduce((a, c) => a + Math.max(0, c.saldo), 0);
  const porPagar = proveedores.reduce((a, p) => a + Math.max(0, -p.saldo), 0);
  const ultimos = movs.slice(0, 6);
  const ordenesAbiertas = ordenes.filter(
    (o) => o.estado === "borrador" || o.estado === "en_proceso",
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inicio</h1>
          <p className="text-sm capitalize text-muted-foreground">{nombre}</p>
        </div>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              render={<Link href="/movimientos/nuevo" />}
            >
              <ArrowLeftRightIcon className="size-4" />
              Movimiento
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/produccion/nueva" />}
            >
              <FactoryIcon className="size-4" />
              Producción
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/productos/nuevo" />}
            >
              <PackagePlusIcon className="size-4" />
              Producto
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={`Ventas de ${nombre}`}
          value={fmtMoney(reporte.totalIngresos)}
          sub={`${fmtNumber(reporte.totalUnidades)} u. vendidas`}
        />
        <StatTile
          label="Resultado bruto"
          value={fmtMoney(reporte.totalBruto)}
          tone={reporte.totalBruto >= 0 ? "good" : "bad"}
          sub={
            reporte.totalMargen != null
              ? `margen ${fmtNumber(reporte.totalMargen)}%`
              : "sin ventas en el mes"
          }
        />
        <StatTile
          label="Valor de inventario"
          value={fmtMoney(valorInventario)}
          tone={criticas.length ? "warn" : "default"}
          sub={
            criticas.length
              ? `${criticas.length} variante${criticas.length === 1 ? "" : "s"} bajo mínimo`
              : "stock OK"
          }
        />
        <StatTile
          label="Cuentas corrientes"
          value={fmtMoney(porCobrar)}
          sub={`por cobrar · ${fmtMoney(porPagar)} por pagar`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangleIcon className="size-4 text-[var(--color-chart-2)]" />
              Stock crítico
              {criticas.length > 0 ? (
                <Badge variant="destructive">{criticas.length}</Badge>
              ) : null}
            </CardTitle>
            <CardAction>
              <Link
                href="/stock"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver stock
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {criticas.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Todo el stock está por encima del mínimo.
              </p>
            ) : (
              <ul className="divide-y">
                {criticas.slice(0, 8).map((f) => (
                  <li
                    key={f.varianteId}
                    className="flex items-center gap-3 py-2"
                  >
                    <Badge
                      variant={f.estado === "sin" ? "destructive" : "outline"}
                      className="shrink-0"
                    >
                      {f.estado === "sin" ? "Sin stock" : "Bajo mín."}
                    </Badge>
                    <Link
                      href={`/productos/${f.productoId}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                    >
                      {f.productoNombre}
                      <span className="text-muted-foreground">
                        {" — "}
                        {f.varianteNombre}
                      </span>
                    </Link>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {fmtNumber(f.stock)} / {fmtNumber(f.stockMin)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos movimientos</CardTitle>
            <CardAction>
              <Link
                href="/movimientos"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver todos
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            {ultimos.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin movimientos todavía.
              </p>
            ) : (
              <ul className="divide-y">
                {ultimos.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 py-2">
                    <Badge variant="secondary" className="shrink-0">
                      {TIPO_LABEL[m.tipo]}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {m.cliente?.nombre ?? m.proveedor?.nombre ?? "—"}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {fmtDate(m.fecha)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {ordenesAbiertas.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FactoryIcon className="size-4 text-muted-foreground" />
              Órdenes de producción abiertas
              <Badge variant="outline">{ordenesAbiertas.length}</Badge>
            </CardTitle>
            <CardAction>
              <Link
                href="/produccion"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver producción
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {ordenesAbiertas.slice(0, 5).map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2">
                  <Link
                    href={`/produccion/${o.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                  >
                    {o.terminadoLabel}
                  </Link>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {fmtNumber(o.cantidad)} u.
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtDate(o.fecha)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
