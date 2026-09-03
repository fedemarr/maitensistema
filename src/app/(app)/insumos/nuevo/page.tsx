import Link from "next/link";
import { redirect } from "next/navigation";

import { listProveedores } from "@/features/proveedores/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { InsumoForm } from "../_components/insumo-form";

export const metadata = { title: "Nuevo insumo — Maitén" };

export default async function NuevoInsumoPage() {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/insumos");

  const proveedores = await listProveedores();

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
      </div>
      <InsumoForm proveedores={proveedores} />
    </div>
  );
}
