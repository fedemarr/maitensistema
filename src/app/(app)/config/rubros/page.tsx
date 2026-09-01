import { listRubros } from "@/features/rubros/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { RubrosManager } from "./_rubros-manager";

export const metadata = { title: "Rubros — Maitén" };

export default async function RubrosPage() {
  const user = await requireUser();
  const rubros = await listRubros();
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Rubros</h1>
        <p className="text-sm text-muted-foreground">
          Categorías de producto para organizar el catálogo.
        </p>
      </div>

      <RubrosManager rubros={rubros} editable={editable} />
    </div>
  );
}
