import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  indicadoresStock,
  listStockProductos,
} from "@/features/stock/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtMoney, fmtNumber } from "@/lib/format";

import { StockTabla } from "./_components/stock-tabla";

export const metadata = { title: "Stock — Maitén" };

export default async function StockPage() {
  const user = await requireUser();
  const productos = await listStockProductos();
  const ind = indicadoresStock(productos);

  const tiles = [
    { k: "En depósito", v: fmtNumber(ind.enDeposito), d: "Disponible para vender" },
    {
      k: "En consignación",
      v: fmtNumber(ind.enConsignacion),
      d: "En clientes, todavía tuyo",
    },
    {
      k: "Bajo mínimo / sin stock",
      v: String(ind.bajoMinimo),
      d: "Productos a reponer",
    },
    {
      k: "Valor del inventario",
      v: fmtMoney(ind.valorInventario),
      d: "Total propio × PPP",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Foto en vivo del stock de producto terminado, por producto y lote.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.k} className="gap-1">
            <CardHeader className="pb-0">
              <CardTitle className="text-[11px] uppercase text-muted-foreground">
                {t.k}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{t.v}</p>
              <p className="text-xs text-muted-foreground">{t.d}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <StockTabla
        productos={productos}
        editable={puedeEscribir(user.rol)}
        esAdmin={user.rol === "admin"}
      />
    </div>
  );
}
