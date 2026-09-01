import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listProveedores } from "@/features/proveedores/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ProveedoresList } from "./_components/proveedores-list";

export const metadata = { title: "Proveedores — Maitén" };

export default async function ProveedoresPage() {
  const user = await requireUser();
  const proveedores = await listProveedores();
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            {proveedores.length}{" "}
            {proveedores.length === 1 ? "proveedor" : "proveedores"}
          </p>
        </div>
        {editable ? (
          <Button render={<Link href="/proveedores/nuevo" />}>
            Nuevo proveedor
          </Button>
        ) : null}
      </div>

      <ProveedoresList proveedores={proveedores} editable={editable} />
    </div>
  );
}
