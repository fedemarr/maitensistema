import { listLotes } from "@/features/insumos/queries";
import {
  fabricacionPorLoteMap,
  listOrdenes,
  minimosVigencias,
  preciosFabPorProducto,
  recetaConStock,
  terminadosConReceta,
  type LineaPlan,
} from "@/features/produccion/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { OrdenesTabla } from "./_components/ordenes-tabla";
import { PlanificarForm } from "./_components/planificar-form";
import { ProduccionTabs } from "./_components/produccion-tabs";

export const metadata = { title: "Producción — Maitén" };

export default async function ProduccionPage() {
  const user = await requireUser();
  const editable = puedeEscribir(user.rol);

  const [terminados, lotes, ordenes, preciosFab, minimos, fabPorLote] =
    await Promise.all([
      terminadosConReceta(),
      listLotes(),
      listOrdenes(),
      preciosFabPorProducto(),
      minimosVigencias(),
      fabricacionPorLoteMap(),
    ]);

  const recetas: Record<string, LineaPlan[]> = {};
  for (const t of terminados) {
    recetas[t.id] = await recetaConStock(t.id);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Producción</h1>
        <p className="text-sm text-muted-foreground">
          Órdenes de fabricación: planificar → cerrar. Solo una orden cerrada
          mueve stock.
        </p>
      </div>

      <ProduccionTabs />

      {editable ? (
        <PlanificarForm
          terminados={terminados}
          lotes={lotes}
          recetas={recetas}
          preciosFab={preciosFab}
          minimos={minimos}
          fabPorLote={fabPorLote}
        />
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Órdenes
        </h2>
        <OrdenesTabla
          ordenes={ordenes}
          esAdmin={user.rol === "admin"}
          editable={editable}
        />
      </div>
    </div>
  );
}
