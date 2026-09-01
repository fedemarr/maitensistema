import Link from "next/link";
import { redirect } from "next/navigation";

import { puedeEscribir, requireUser } from "@/lib/auth";

import { ProveedorForm } from "../_components/proveedor-form";

export const metadata = { title: "Nuevo proveedor — Maitén" };

export default async function NuevoProveedorPage() {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/proveedores");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href="/proveedores"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Proveedores
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo proveedor</h1>
      </div>
      <ProveedorForm />
    </div>
  );
}
