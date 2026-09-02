import Link from "next/link";
import { redirect } from "next/navigation";

import { varianteTerminadoConReceta } from "@/features/recetas/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { OrdenForm } from "../_components/orden-form";

export const metadata = { title: "Nueva orden de producción — Maitén" };

export default async function NuevaOrdenPage() {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/produccion");

  const rows = await varianteTerminadoConReceta();
  const terminados = rows.map((r) => ({
    varianteId: r.varianteId,
    label: `${r.productoNombre} — ${r.label}`,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link
          href="/produccion"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Producción
        </Link>
        <h1 className="text-2xl font-semibold">Nueva orden de producción</h1>
      </div>
      <OrdenForm terminados={terminados} />
    </div>
  );
}
