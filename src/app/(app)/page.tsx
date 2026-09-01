import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listStock } from "@/features/stock/queries";
import { fmtNumber } from "@/lib/format";

const PROXIMO = [
  "Ficha de producto con historial/resumen",
  "Reporte económico mensual",
  "Cuentas corrientes",
  "Consignaciones",
];

export default async function DashboardPage() {
  const filas = await listStock();
  const criticas = filas.filter((f) => f.estado !== "ok");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inicio</h1>
        <p className="text-sm text-muted-foreground">
          Panel de stock y módulos en construcción (Fase 2).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Stock crítico{" "}
            {criticas.length > 0 ? (
              <Badge variant="destructive" className="ml-1 align-middle">
                {fmtNumber(criticas.length)}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Variantes bajo el mínimo o sin stock. La lista completa está en{" "}
            <Link href="/stock" className="font-medium underline">
              /stock
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {criticas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay faltantes: todo el stock está OK.
            </p>
          ) : (
            <ul className="divide-y">
              {criticas.map((f) => (
                <li key={f.varianteId} className="flex items-center gap-3 py-2">
                  <Badge
                    variant={f.estado === "sin" ? "destructive" : "default"}
                    className="shrink-0"
                  >
                    {f.estado === "sin" ? "Sin stock" : "Bajo mínimo"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/productos/${f.productoId}`}
                      className="font-medium hover:underline"
                    >
                      {f.productoNombre}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {" — "}
                      {f.varianteNombre}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {fmtNumber(f.stock)} / mín {fmtNumber(f.stockMin)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos pasos</CardTitle>
          <CardDescription>Orden de construcción (Fase 2).</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {PROXIMO.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}