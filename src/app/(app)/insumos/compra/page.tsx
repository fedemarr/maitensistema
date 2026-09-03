import Link from "next/link";
import { redirect } from "next/navigation";

import {
  listInsumosParaCompra,
  listLotes,
  recetaParaSugerencia,
} from "@/features/insumos/queries";
import { listProductos } from "@/features/productos/queries";
import { listProveedores } from "@/features/proveedores/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { CompraForm } from "../_components/compra-form";

export const metadata = { title: "Registrar compra — Maitén" };

export default async function CompraPage() {
  const user = await requireUser();
  if (!puedeEscribir(user.rol)) redirect("/insumos");

  const [insumos, terminadosRaw, lotes, proveedores] = await Promise.all([
    listInsumosParaCompra(),
    listProductos(),
    listLotes(),
    listProveedores(),
  ]);

  const terminados = terminadosRaw.map((t) => ({ id: t.id, nombre: t.nombre }));
  const recetas: Record<
    string,
    { insumoId: string; cantidadPorUnidad: number }[]
  > = {};
  for (const t of terminados) {
    recetas[t.id] = await recetaParaSugerencia(t.id);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link
          href="/insumos"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Insumos
        </Link>
        <h1 className="text-2xl font-semibold">Registrar compra de insumos</h1>
        <p className="text-sm text-muted-foreground">
          Toda la tanda en una sola carga. Completá solo las filas que compraste.
        </p>
      </div>
      <CompraForm
        insumos={insumos}
        terminados={terminados}
        lotes={lotes}
        proveedores={proveedores}
        recetas={recetas}
      />
    </div>
  );
}
