import Link from "next/link";
import { redirect } from "next/navigation";

import { listRubros } from "@/features/rubros/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ProductoForm } from "../_components/producto-form";

export const metadata = { title: "Nuevo producto — Maitén" };

export default async function NuevoProductoPage() {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/productos");

  const rubros = await listRubros(true);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href="/productos"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Productos
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          La receta se carga después, desde la ficha del producto.
        </p>
      </div>
      <ProductoForm rubros={rubros} />
    </div>
  );
}
