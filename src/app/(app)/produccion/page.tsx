import { listLotes } from "@/features/insumos/queries";
import {
  historialFabricacion,
  listOrdenes,
  precioFabricacionVigente,
  recetaConStock,
  terminadosConReceta,
  type LineaPlan,
} from "@/features/produccion/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { OrdenesTabla } from "./_components/ordenes-tabla";
import { PlanificarForm } from "./_components/planificar-form";

export const metadata = { title: "Producción — Maitén" };

export default async function ProduccionPage() {
  const user = await requireUser();
  const editable = puedeEscribir(user.rol);
  const hoy = new Date().toISOString().slice(0, 10);

  const [terminados, lotes, ordenes, fabVigente, fabHistorial] =
    await Promise.all([
      terminadosConReceta(),
      listLotes(),
      listOrdenes(),
      precioFabricacionVigente(hoy),
      historialFabricacion(),
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

      {editable ? (
        <PlanificarForm
          terminados={terminados}
          lotes={lotes}
          recetas={recetas}
          fabVigente={
            fabVigente
              ? {
                  montoPorLote: fabVigente.montoPorLote,
                  vigenteDesde: fabVigente.vigenteDesde,
                }
              : null
          }
          fabHistorial={fabHistorial.map((h) => ({
            montoPorLote: h.montoPorLote,
            vigenteDesde: h.vigenteDesde,
          }))}
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
