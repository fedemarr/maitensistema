import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resumenInicio } from "@/features/dashboard/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtMoney, fmtNumber } from "@/lib/format";

export const metadata = { title: "Inicio — Maitén" };

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default async function DashboardPage() {
  const user = await requireUser();
  const editable = puedeEscribir(user.rol);
  const r = await resumenInicio();

  const ahora = new Date();
  const mesLabel = `${MESES[ahora.getMonth()]} ${ahora.getFullYear()}`;

  const tarjetas = [
    {
      k: "Productos a reponer",
      v: fmtNumber(r.alertasStock),
      d: "bajo mínimo o sin stock",
      alerta: r.alertasStock > 0,
      href: "/stock",
    },
    {
      k: "Consignaciones vencidas",
      v: fmtNumber(r.consignacionesVencidas),
      d: "con unidades pendientes",
      alerta: r.consignacionesVencidas > 0,
      href: "/consignaciones",
    },
    {
      k: "Por cobrar",
      v: fmtMoney(r.porCobrar),
      d: "saldo de clientes en cuenta corriente",
      alerta: r.porCobrar > 0,
      href: "/clientes",
    },
    {
      k: `Resultado bruto · ${mesLabel}`,
      v: fmtMoney(r.mes.bruto),
      d: `${fmtNumber(r.mes.unidades)} u vendidas · ${fmtMoney(r.mes.ingresos)} ingresos`,
      href: "/reportes",
    },
  ];

  const atajos = [
    { href: "/movimientos/nuevo", label: "Nuevo movimiento" },
    { href: "/produccion", label: "Planificar producción" },
    { href: "/insumos/compra", label: "Registrar compra" },
    { href: "/reportes", label: "Ver reportes" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {user.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          Resumen del sistema de gestión Maitén.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tarjetas.map((t) => (
          <Link key={t.k} href={t.href} className="group">
            <Card className="h-full gap-1 transition-colors group-hover:bg-muted/40">
              <CardHeader className="pb-0">
                <CardTitle className="text-[11px] uppercase text-muted-foreground">
                  {t.k}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold tabular-nums ${
                    t.alerta ? "text-destructive" : ""
                  }`}
                >
                  {t.v}
                </p>
                <p className="text-xs text-muted-foreground">{t.d}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {atajos.map((a) => (
              <Button
                key={a.href}
                size="sm"
                variant="outline"
                render={<Link href={a.href} />}
              >
                {a.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
