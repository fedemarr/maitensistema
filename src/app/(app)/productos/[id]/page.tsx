import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getProducto,
  getRecetaVigente,
  listInsumosActivos,
  listVersionesReceta,
} from "@/features/productos/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtMoney, fmtNumber } from "@/lib/format";

import { ProductoAcciones } from "./_acciones";
import { RecetaTab } from "./_components/receta-tab";

export default async function FichaProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const producto = await getProducto(id);
  if (!producto) notFound();

  const editable = puedeEscribir(user.rol);
  const [vigente, versiones, insumos] = await Promise.all([
    getRecetaVigente(id),
    listVersionesReceta(id),
    listInsumosActivos(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/productos"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Productos
          </Link>
          <h1 className="text-2xl font-semibold">{producto.nombre}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            {producto.sku}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {producto.rubro ? (
              <Badge variant="secondary">{producto.rubro.nombre}</Badge>
            ) : null}
            {producto.presentacion ? (
              <Badge variant="outline">{producto.presentacion}</Badge>
            ) : null}
            {producto.activo ? (
              <Badge variant="secondary">Activo</Badge>
            ) : (
              <Badge variant="outline">Inactivo</Badge>
            )}
            {producto.online ? <Badge variant="outline">Online</Badge> : null}
          </div>
        </div>
        {editable ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href={`/productos/${id}/editar`} />}
            >
              Editar
            </Button>
            <ProductoAcciones id={id} activo={producto.activo} />
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Stock mínimo
            </p>
            <p className="text-sm tabular-nums">
              {fmtNumber(producto.stockMinimo)} u
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              PPP (costo promedio)
            </p>
            <p className="text-sm tabular-nums">{fmtMoney(producto.ppp)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Rubro
            </p>
            <p className="text-sm">{producto.rubro?.nombre ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <RecetaTab
        productoId={id}
        vigente={vigente}
        versiones={versiones}
        insumos={insumos}
        editable={editable}
      />
    </div>
  );
}
