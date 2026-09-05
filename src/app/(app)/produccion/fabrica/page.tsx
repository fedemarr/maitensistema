import {
  historialMinimo,
  tarifarioFabrica,
} from "@/features/produccion/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { FabricaPanel } from "../_components/fabrica-panel";
import { ProduccionTabs } from "../_components/produccion-tabs";

export const metadata = { title: "Fábrica — Maitén" };

export default async function FabricaPage() {
  const user = await requireUser();
  const editable = puedeEscribir(user.rol);

  const [tarifario, minimos] = await Promise.all([
    tarifarioFabrica(),
    historialMinimo(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Producción</h1>
        <p className="text-sm text-muted-foreground">
          Tarifario de la fábrica y mínimo de compra por orden. Todo sin IVA.
        </p>
      </div>

      <ProduccionTabs />

      <FabricaPanel
        productos={tarifario.productos}
        precios={tarifario.historial}
        minimos={minimos}
        editable={editable}
      />
    </div>
  );
}
