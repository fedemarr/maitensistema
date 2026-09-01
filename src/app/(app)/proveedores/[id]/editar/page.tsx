import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getProveedor } from "@/features/proveedores/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ProveedorForm } from "../../_components/proveedor-form";

export const metadata = { title: "Editar proveedor — Maitén" };

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect(`/proveedores/${id}`);

  const proveedor = await getProveedor(id);
  if (!proveedor) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href={`/proveedores/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {proveedor.nombre}
        </Link>
        <h1 className="text-2xl font-semibold">Editar proveedor</h1>
      </div>
      <ProveedorForm proveedor={proveedor} />
    </div>
  );
}
