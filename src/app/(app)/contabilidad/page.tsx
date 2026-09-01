import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saldosClave } from "@/features/contabilidad/queries";
import { fmtMoney } from "@/lib/format";

export const metadata = { title: "Contabilidad — Maitén" };

export default async function ContabilidadPage() {
  const s = await saldosClave();

  const tiles = [
    { label: "Caja", saldo: s.caja?.saldo ?? 0, activa: s.caja?.activo ?? true },
    { label: "Banco", saldo: s.banco?.saldo ?? 0, activa: s.banco?.activo ?? true },
    { label: "Mercadería", saldo: s.mercaderia?.saldo ?? 0, activa: s.mercaderia?.activo ?? true },
    { label: "Mercadería en consignación", saldo: s.mercaderiaConsignacion?.saldo ?? 0, activa: s.mercaderiaConsignacion?.activo ?? true },
    { label: "Deudores por ventas", saldo: s.deudores?.saldo ?? 0, activa: s.deudores?.activo ?? true },
    { label: "Proveedores a pagar", saldo: s.proveedores?.saldo ?? 0, activa: s.proveedores?.activo ?? true },
  ];

  const rutas = [
    { href: "/contabilidad/balance-general", titulo: "Balance general", desc: "Balance de comprobación y estado patrimonial por cuenta." },
    { href: "/contabilidad/resultados", titulo: "Resultados", desc: "Estado de resultados mensual (ingresos, gastos y resultado)." },
    { href: "/contabilidad/asientos", titulo: "Asientos", desc: "Diario de asientos automáticos derivados de los movimientos." },
    { href: "/contabilidad/plan-cuentas", titulo: "Plan de cuentas", desc: "Alta, edición y activación de cuentas contables (admin)." },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Contabilidad</h1>
        <p className="text-sm text-muted-foreground">
          Partida doble automática: cada movimiento genera su asiento al confirmarse.
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
              {!t.activa ? (
                <p className="text-xs text-muted-foreground">cuenta inactiva</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {rutas.map((r) => (
          <Link key={r.href} href={r.href} className="group">
            <Card className="transition-colors group-hover:bg-muted/40">
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