import { listClientesConSaldo } from "@/features/cc/queries";

import { TercerosCCTable } from "../cc/_components/terceros-table";

export const metadata = { title: "CC Clientes — Maitén" };

export default async function CCClientesPage() {
  const clientes = await listClientesConSaldo();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Cuenta corriente — Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Saldos de cada cliente (lo que les falta pagar).
        </p>
      </div>
      <TercerosCCTable terceros={clientes} baseHref="/cc-clientes" />
    </div>
  );
}