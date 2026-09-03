import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getInsumo } from "@/features/insumos/queries";
import { listProveedores } from "@/features/proveedores/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { InsumoForm } from "../../_components/insumo-form";

export const metadata = { title: "Editar insumo — Maitén" };

export default async function EditarInsumoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/insumos");

  const [insumo, proveedores] = await Promise.all([
    getInsumo(id),
    listProveedores(),
  ]);
  if (!insumo) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href="/insumos"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Insumos
        </Link>
        <h1 className="text-2xl font-semibold">Editar insumo</h1>
      </div>
      <InsumoForm insumo={insumo} proveedores={proveedores} />
    </div>
  );
}
