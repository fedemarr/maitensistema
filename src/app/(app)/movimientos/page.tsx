import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listMovimientos } from "@/features/movimientos/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { MovimientosHistorial } from "./_components/movimientos-historial";

export const metadata = { title: "Movimientos — Maitén" };

export default async function MovimientosPage() {
  const user = await requireUser();
  const rows = await listMovimientos();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            Salidas de producto terminado y ajustes. El tipo define el impacto en
            el reporte.
          </p>
        </div>
        {puedeEscribir(user.rol) ? (
          <Button render={<Link href="/movimientos/nuevo" />}>
            Nuevo movimiento
          </Button>
        ) : null}
      </div>

      <MovimientosHistorial rows={rows} />
    </div>
  );
}
