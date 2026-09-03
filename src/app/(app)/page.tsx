import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { puedeEscribir, requireUser } from "@/lib/auth";

export const metadata = { title: "Inicio — Maitén" };

const ATAJOS = [
  { href: "/movimientos", label: "Movimientos" },
  { href: "/produccion", label: "Producción" },
  { href: "/stock", label: "Stock" },
  { href: "/productos", label: "Productos" },
];

export default async function DashboardPage() {
  const user = await requireUser();
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {user.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          Sistema de gestión Maitén.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fase 4 en curso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            El sistema se está reconstruyendo según la especificación funcional:
            modelo de stock con FIFO por lote y PPP móvil, recetas versionadas,
            producción en dos etapas y reporte económico con cascada.
          </p>
          {editable ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {ATAJOS.map((a) => (
                <Button
                  key={a.href}
                  size="sm"
                  variant="outline"
                  render={<Link href={a.href} />}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
