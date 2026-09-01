import { requireUser } from "@/lib/auth";
import { listRubros } from "@/features/rubros/queries";
import { listStock } from "@/features/stock/queries";

import { StockDashboard } from "./_components/stock-dashboard";

export const metadata = { title: "Stock — Maitén" };

export default async function StockPage() {
  const [user, filas, rubros] = await Promise.all([
    requireUser(),
    listStock(),
    listRubros(true),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Foto del stock de todo el negocio: qué falta comprar o producir.
        </p>
      </div>
      <StockDashboard filas={filas} rubros={rubros} esAdmin={user.rol === "admin"} />
    </div>
  );
}