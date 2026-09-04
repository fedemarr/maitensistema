import { listCostosFijos } from "@/features/costos-fijos/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { CostosFijosManager } from "./_components/costos-fijos-manager";

export const metadata = { title: "Costos fijos — Maitén" };

export default async function CostosFijosPage() {
  const user = await requireUser();
  const costos = await listCostosFijos();
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Costos fijos</h1>
        <p className="text-sm text-muted-foreground">
          Costos mensuales recurrentes (alquiler, sueldos, servicios…). Se
          restan del resultado antes de costos fijos en Reportes para llegar
          al EBIT. &ldquo;Nueva versión&rdquo; cuando cambia el monto; queda
          el historial.
        </p>
      </div>

      <CostosFijosManager costos={costos} editable={editable} />
    </div>
  );
}
