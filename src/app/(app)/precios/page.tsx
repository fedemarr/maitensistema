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
          Se carga el precio <b>neto</b> (sin IVA); el sistema muestra al lado
          el precio con IVA como referencia. Mayorista vacío = usa retail. Se
          precarga en Movimientos según el tipo de cliente, editable en la venta.
        </p>
      </div>

      <PreciosManager productos={productos} editable={editable} />
    </div>
  );
}
