import { listPlanCuentas } from "@/features/finanzas/queries";
import { requireUser } from "@/lib/auth";

import { PlanCuentasManager } from "./_plan-cuentas-manager";

export const metadata = { title: "Plan de cuentas — Maitén" };

export default async function PlanCuentasPage() {
  const user = await requireUser();
  const cuentas = await listPlanCuentas();
  const admin = user.rol === "admin";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Plan de cuentas</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de cuentas contables. Solo el admin puede crear o modificar
          cuentas.
        </p>
      </div>

      <PlanCuentasManager cuentas={cuentas} admin={admin} />
    </div>
  );
}
