import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCliente } from "@/features/clientes/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ClienteForm } from "../../_components/cliente-form";

export const metadata = { title: "Editar cliente — Maitén" };

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect(`/clientes/${id}`);

  const cliente = await getCliente(id);
  if (!cliente) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href={`/clientes/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {cliente.nombre}
        </Link>
        <h1 className="text-2xl font-semibold">Editar cliente</h1>
      </div>
      <ClienteForm cliente={cliente} />
    </div>
  );
}
