import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  indicadoresConsig,
  listConsignaciones,
} from "@/features/consignaciones/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtMoney, fmtNumber } from "@/lib/format";

import { ConsignacionesTabla } from "./_components/consignaciones-tabla";

export const metadata = { title: "Consignaciones — Maitén" };

export default async function ConsignacionesPage() {
  const user = await requireUser();
  const rows = await listConsignaciones();
  const ind = indicadoresConsig(rows);

  const tiles = [
    {
      k: "Consignaciones abiertas",
      v: String(ind.abiertas),
      d: "Con unidades pendientes",
    },
    {
      k: "Unidades afuera",
      v: fmtNumber(ind.unidadesAfuera),
      d: "Siguen siendo stock propio",
    },
    {
      k: "Valor a costo afuera",
      v: fmtMoney(ind.valorAfuera),
      d: "Pendientes × PPP",
    },
    { k: "Vencidas", v: String(ind.vencidas), d: "Pasó la fecha y hay pendientes" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Consignaciones</h1>
        <p className="text-sm text-muted-foreground">
          Mercadería entregada a clientes que se cobra cuando venden. Se crean
          desde Movimientos.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
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

      <ConsignacionesTabla rows={rows} editable={puedeEscribir(user.rol)} />
    </div>
  );
}
