import Link from "next/link";
import { redirect } from "next/navigation";

import { puedeEscribir, requireUser } from "@/lib/auth";

import { ClienteForm } from "../_components/cliente-form";

export const metadata = { title: "Nuevo cliente — Maitén" };

export default async function NuevoClientePage() {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/clientes");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href="/clientes"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Clientes
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo cliente</h1>
      </div>
      <ClienteForm />
    </div>
  );
}
