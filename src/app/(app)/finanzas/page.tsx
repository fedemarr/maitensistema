import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saldosClave } from "@/features/finanzas/queries";
import { requireUser } from "@/lib/auth";
import { fmtMoney } from "@/lib/format";

export const metadata = { title: "Finanzas — Maitén" };

export default async function FinanzasPage() {
  await requireUser();
  const s = await saldosClave();

  const tiles = [
    { label: "Caja", saldo: s.caja?.saldo ?? 0 },
    { label: "Banco", saldo: s.banco?.saldo ?? 0 },
    { label: "Mercadería", saldo: s.mercaderia?.saldo ?? 0 },
    {
      label: "Mercadería en consignación",
      saldo: s.mercaderiaConsignacion?.saldo ?? 0,
    },
    { label: "Deudores por ventas", saldo: s.deudores?.saldo ?? 0 },
    { label: "Proveedores a pagar", saldo: s.proveedores?.saldo ?? 0 },
  ];

  const rutas = [
    {
      href: "/finanzas/balance-general",
      titulo: "Balance general",
      desc: "Balance de comprobación y estado patrimonial por cuenta.",
    },
    {
      href: "/finanzas/resultados",
      titulo: "Estado de resultados",
      desc: "Ingresos, gastos y resultado del mes por cuenta contable.",
    },
    {
      href: "/finanzas/asientos",
      titulo: "Libro diario",
      desc: "Asientos de partida doble generados por cada movimiento.",
    },
    {
      href: "/finanzas/plan-cuentas",
      titulo: "Plan de cuentas",
      desc: "Alta, edición y activación de cuentas contables (admin).",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Finanzas</h1>
        <p className="text-sm text-muted-foreground">
          Contabilidad de partida doble: cada venta, compra, producción, cobro y
          pago genera su asiento al confirmarse.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">
                {fmtMoney(t.saldo)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {rutas.map((r) => (
          <Link key={r.href} href={r.href} className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <CardTitle className="text-base">{r.titulo}</CardTitle>
                <CardDescription>{r.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
