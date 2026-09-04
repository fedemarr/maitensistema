import { preciosVigentes } from "@/features/precios/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { PreciosManager } from "./_components/precios-manager";

export const metadata = { title: "Precios — Maitén" };

export default async function PreciosPage() {
  const user = await requireUser();
  const productos = await preciosVigentes();
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Lista de precios</h1>
        <p className="text-sm text-muted-foreground">
          Precio de venta sugerido (con IVA) por producto, retail y mayorista.
          Se precarga en Movimientos al elegir el producto y el cliente, pero
          siempre se puede editar en el momento de la venta.
        </p>
      </div>

      <PreciosManager productos={productos} editable={editable} />
    </div>
  );
}
