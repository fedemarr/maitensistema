import { notFound } from "next/navigation";

import {
  getTerceroSaldo,
  listAsientosDeTercero,
} from "@/features/cc/queries";
import { listMediosPago } from "@/features/movimientos/queries";
import { getProveedor } from "@/features/proveedores/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { CCDetalle } from "../../cc/_components/cc-detalle";

export const metadata = { title: "CC Proveedor — Maitén" };

export default async function CCProveedorDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const proveedor = await getProveedor(id);
  if (!proveedor) notFound();

  const [saldo, asientos, mediosPago] = await Promise.all([
    getTerceroSaldo("proveedor", id),
    listAsientosDeTercero("proveedor", id),
    listMediosPago(true),
  ]);

  return (
    <CCDetalle
      tercero={proveedor}
      entidadTipo="proveedor"
      saldo={saldo}
      asientos={asientos}
      mediosPago={mediosPago}
      editable={puedeEscribir(user.rol)}
    />
  );
}