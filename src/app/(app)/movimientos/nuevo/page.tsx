import Link from "next/link";
import { redirect } from "next/navigation";

import { listLotes } from "@/features/insumos/queries";
import {
  listClientesActivos,
  listProductosVenta,
  movimientoDetalle,
} from "@/features/movimientos/queries";
import { preciosVigentes } from "@/features/precios/queries";
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
    /** Copia los datos de un movimiento con NC total (adenda v1.3 §3). */
    desde?: string;
  }>;
}) {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/movimientos");

  const sp = await searchParams;
  const [productos, clientes, lotes, precios, original] = await Promise.all([
    listProductosVenta(),
    listClientesActivos(),
    listLotes(),
    preciosVigentes(),
    sp.desde ? movimientoDetalle(sp.desde) : Promise.resolve(null),
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
        <h1 className="text-2xl font-semibold">
          {original ? "Cargar movimiento corregido" : "Nuevo movimiento"}
        </h1>
        {original ? (
          <p className="text-sm text-muted-foreground">
            Copiado del movimiento con nota de crédito total. Corregí lo que estaba mal antes de
            guardar.
          </p>
        ) : null}
      </div>
      <MovimientoForm
        productos={productos}
        clientes={clientes}
        lotes={lotes}
        precios={precios}
        pre={
          original
            ? undefined
            : {
                tipo: sp.tipo,
                clienteId: sp.cliente,
                productoId: sp.producto,
                cantidad: sp.cantidad,
              }
        }
        copiarDe={
          original && original.tipo !== "produccion"
            ? {
                tipo: original.tipo,
                clienteId: original.clienteId ?? "",
                medioPago: original.medioPago ?? "",
                observaciones: original.observaciones ?? "",
                items: original.items.map((i) => ({
                  productoId: i.productoId,
                  cantidad: String(i.cantidad),
                  precio: i.precioNeto ?? "",
                })),
              }
            : undefined
        }
      />
    </div>
  );
}
