import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getProducto } from "@/features/productos/queries";
import { listRubros } from "@/features/rubros/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ProductoForm } from "../../_components/producto-form";

export const metadata = { title: "Editar producto — Maitén" };

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect(`/productos/${id}`);

  const [producto, rubros] = await Promise.all([
    getProducto(id),
    listRubros(true),
  ]);
  if (!producto) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href={`/productos/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {producto.nombre}
        </Link>
        <h1 className="text-2xl font-semibold">Editar producto</h1>
      </div>
      <ProductoForm producto={producto} rubros={rubros} />
    </div>
  );
}
