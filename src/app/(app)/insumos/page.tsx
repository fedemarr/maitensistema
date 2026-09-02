import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listProductos } from "@/features/productos/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ProductosList } from "../productos/_components/productos-list";

export const metadata = { title: "Insumos — Maitén" };

export default async function InsumosPage() {
  const user = await requireUser();
  const insumos = await listProductos({ esInsumo: true });
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Insumos</h1>
          <p className="text-sm text-muted-foreground">
            Materia prima y envases. {insumos.length}{" "}
            {insumos.length === 1 ? "insumo" : "insumos"}.
          </p>
        </div>
        {editable ? (
          <Button render={<Link href="/insumos/nuevo" />}>Nuevo insumo</Button>
        ) : null}
      </div>

      <ProductosList productos={insumos} editable={editable} />
    </div>
  );
}
