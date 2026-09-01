import Link from "next/link";
import { redirect } from "next/navigation";

import { puedeEscribir, requireUser } from "@/lib/auth";
import {
  listClientesActivos,
  listMediosPago,
  listProveedoresActivos,
  listVariantesActivas,
} from "@/features/movimientos/queries";

import { MovimientoForm } from "../_components/movimiento-form";

export const metadata = { title: "Nuevo movimiento — Maitén" };

export default async function NuevoMovimientoPage() {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/movimientos");

  const [clientes, proveedores, mediosPago, variantes] = await Promise.all([
    listClientesActivos(),
    listProveedoresActivos(),
    listMediosPago(true),
    listVariantesActivas(),
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
        clientes={clientes}
        proveedores={proveedores}
        mediosPago={mediosPago}
        variantes={variantes}
      />
    </div>
  );
}
