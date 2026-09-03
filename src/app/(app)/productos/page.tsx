import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listProductos } from "@/features/productos/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ProductosList } from "./_components/productos-list";

export const metadata = { title: "Productos — Maitén" };

export default async function ProductosPage() {
  const user = await requireUser();
  const productos = await listProductos();
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Productos terminados y su receta. El precio y el costo no viven acá.
          </p>
        </div>
        {editable ? (
          <Button render={<Link href="/productos/nuevo" />}>
            Nuevo producto
          </Button>
        ) : null}
      </div>

      <ProductosList productos={productos} />
    </div>
  );
}
