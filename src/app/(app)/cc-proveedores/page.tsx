import { listProveedoresConSaldo } from "@/features/cc/queries";

import { TercerosCCTable } from "../cc/_components/terceros-table";

export const metadata = { title: "CC Proveedores — Maitén" };

export default async function CCProveedoresPage() {
  const proveedores = await listProveedoresConSaldo();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Cuenta corriente — Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Saldos con cada proveedor (lo que Maitén les debe).
        </p>
      </div>
      <TercerosCCTable terceros={proveedores} baseHref="/cc-proveedores" />
    </div>
  );
}