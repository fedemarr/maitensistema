import Link from "next/link";
import { redirect } from "next/navigation";

import { listRubros } from "@/features/rubros/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ProductoForm } from "../../productos/_components/producto-form";

export const metadata = { title: "Nuevo insumo — Maitén" };

export default async function NuevoInsumoPage() {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/insumos");

  const rubros = await listRubros(true);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href="/insumos"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Insumos
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo insumo</h1>
        <p className="text-sm text-muted-foreground">
          Cada variante es una unidad de compra (ej: &quot;Bidón 5 L&quot;,
          &quot;Caja x100&quot;).
        </p>
      </div>
      <ProductoForm rubros={rubros} esInsumo />
    </div>
  );
}
