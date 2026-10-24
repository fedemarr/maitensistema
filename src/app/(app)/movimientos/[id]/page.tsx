import Link from "next/link";
import { notFound } from "next/navigation";

import { listLotes } from "@/features/insumos/queries";
import {
  historialMovimiento,
  listClientesActivos,
  listProductosVenta,
  movimientoDetalle,
} from "@/features/movimientos/queries";
import { requireUser } from "@/lib/auth";

import { MovimientoDetalleView } from "../_components/movimiento-detalle-view";

export const metadata = { title: "Movimiento — Maitén" };

export default async function MovimientoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const [detalle, historial, productos, clientes, lotes] = await Promise.all([
    movimientoDetalle(id),
    historialMovimiento(id),
    listProductosVenta(),
    listClientesActivos(),
    listLotes(),
  ]);
  if (!detalle) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/movimientos" className="text-sm text-muted-foreground hover:underline">
        ← Movimientos
      </Link>
      <MovimientoDetalleView
        detalle={detalle}
        historial={historial}
        productos={productos}
        clientes={clientes}
        lotes={lotes}
        rol={user.rol}
      />
    </div>
  );
}
