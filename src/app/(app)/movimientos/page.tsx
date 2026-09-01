import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listMovimientos } from "@/features/movimientos/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { MovimientosList } from "./_components/movimientos-list";

export const metadata = { title: "Movimientos — Maitén" };

export default async function MovimientosPage() {
  const user = await requireUser();
  const movimientos = await listMovimientos({});
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            {movimientos.length}{" "}
            {movimientos.length === 1 ? "movimiento" : "movimientos"}
          </p>
        </div>
        {editable ? (
          <Button render={<Link href="/movimientos/nuevo" />}>
            Nuevo movimiento
          </Button>
        ) : null}
      </div>

      <MovimientosList movimientos={movimientos} />
    </div>
  );
}
