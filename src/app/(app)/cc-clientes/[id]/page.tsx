import { notFound } from "next/navigation";

import {
  getTerceroSaldo,
  listAsientosDeTercero,
} from "@/features/cc/queries";
import { getCliente } from "@/features/clientes/queries";
import { listMediosPago } from "@/features/movimientos/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { CCDetalle } from "../../cc/_components/cc-detalle";

export const metadata = { title: "CC Cliente — Maitén" };

export default async function CCClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const cliente = await getCliente(id);
  if (!cliente) notFound();

  const [saldo, asientos, mediosPago] = await Promise.all([
    getTerceroSaldo("cliente", id),
    listAsientosDeTercero("cliente", id),
    listMediosPago(true),
  ]);

  return (
    <CCDetalle
      tercero={cliente}
      entidadTipo="cliente"
      saldo={saldo}
      asientos={asientos}
      mediosPago={mediosPago}
      editable={puedeEscribir(user.rol)}
    />
  );
}