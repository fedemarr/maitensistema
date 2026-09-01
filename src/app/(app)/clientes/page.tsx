import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listClientes } from "@/features/clientes/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ClientesList } from "./_components/clientes-list";

export const metadata = { title: "Clientes — Maitén" };

export default async function ClientesPage() {
  const user = await requireUser();
  const clientes = await listClientes();
  const editable = puedeEscribir(user.rol);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {clientes.length}{" "}
            {clientes.length === 1 ? "cliente" : "clientes"}
          </p>
        </div>
        {editable ? (
          <Button render={<Link href="/clientes/nuevo" />}>
            Nuevo cliente
          </Button>
        ) : null}
      </div>

      <ClientesList clientes={clientes} editable={editable} />
    </div>
  );
}
