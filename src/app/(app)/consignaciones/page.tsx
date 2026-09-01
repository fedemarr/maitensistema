import { requireUser } from "@/lib/auth";
import { listConsignaciones } from "@/features/consignaciones/queries";
import { listMediosPago } from "@/features/movimientos/queries";

import { ConsignacionesList } from "./_components/consignaciones-list";

export const metadata = { title: "Consignaciones — Maitén" };

export default async function ConsignacionesPage() {
  const [user, consignaciones, mediosPago] = await Promise.all([
    requireUser(),
    listConsignaciones(),
    listMediosPago(true),
  ]);
  const editable = user.rol === "admin" || user.rol === "ventas";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Consignaciones</h1>
        <p className="text-sm text-muted-foreground">
          Mercadería entregada a clientes que se cobra cuando venden. Las nuevas
          se crean desde Movimientos.
        </p>
      </div>
      <ConsignacionesList
        consignaciones={consignaciones}
        mediosPago={mediosPago}
        editable={editable}
      />
    </div>
  );
}