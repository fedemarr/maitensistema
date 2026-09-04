import Link from "next/link";
import { redirect } from "next/navigation";

import { listLotes } from "@/features/insumos/queries";
import {
  listClientesActivos,
  listProductosVenta,
} from "@/features/movimientos/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { MovimientoForm } from "../_components/movimiento-form";

export const metadata = { title: "Nuevo movimiento — Maitén" };

export default async function NuevoMovimientoPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    cliente?: string;
    producto?: string;
    cantidad?: string;
  }>;
}) {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/movimientos");

  const sp = await searchParams;
  const [productos, clientes, lotes] = await Promise.all([
    listProductosVenta(),
    listClientesActivos(),
    listLotes(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link
          href="/movimientos"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Movimientos
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo movimiento</h1>
      </div>
      <MovimientoForm
        productos={productos}
        clientes={clientes}
        lotes={lotes}
        pre={{
          tipo: sp.tipo,
          clienteId: sp.cliente,
          productoId: sp.producto,
          cantidad: sp.cantidad,
        }}
      />
    </div>
  );
}
