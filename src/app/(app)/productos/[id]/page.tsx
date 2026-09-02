import Image from "next/image";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getProducto,
  listMovimientosDeProducto,
  listVariantesActivas,
} from "@/features/productos/queries";
import { getFotoUrl } from "@/features/productos/storage";
import { getRecetaActiva } from "@/features/recetas/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtMoney, fmtNumber } from "@/lib/format";

import { ProductoAcciones } from "./_acciones";
import { HistoricoMovimientos } from "./_components/historico-movimientos";
import { RecetaEditor } from "./_components/receta-editor";

export default async function FichaProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const producto = await getProducto(id);
  if (!producto) notFound();
  const movimientos = await listMovimientosDeProducto(id);

  const editable = puedeEscribir(user.rol);
  const fotoUrl = await getFotoUrl(producto.fotoPath);
  const activas = producto.variantes.filter((v) => v.activo);

  // Recetas: solo para productos terminados.
  const insumos = producto.esInsumo ? [] : await listVariantesActivas(true);
  const recetas = producto.esInsumo
    ? []
    : await Promise.all(
        activas.map(async (v) => ({
          varianteId: v.id,
          varianteNombre: v.nombre,
          receta: await getRecetaActiva(v.id),
        })),
      );
  const stockTotal = activas.reduce((a, v) => a + v.stock, 0);
  const bajoMinimo = activas.some((v) => v.stock < v.stockMin);
  const valorStock = activas.reduce(
    (a, v) => a + v.stock * Number(v.costoPromedio),
    0,
  );

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
            <ProductoAcciones id={id} activo={producto.activo} rol={user.rol} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Stock total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-4xl font-bold tabular-nums ${
                bajoMinimo ? "text-destructive" : ""
              }`}
            >
              {fmtNumber(stockTotal)}
            </p>
            {bajoMinimo ? (
              <p className="mt-1 text-xs text-destructive">
                Hay variantes bajo el mínimo.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Precio de lista
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {fmtMoney(producto.precioLista)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Valor de stock (costo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {fmtMoney(valorStock)}
            </p>
          </CardContent>
        </Card>
      </div>

      {fotoUrl ? (
        <div className="overflow-hidden rounded-lg border">
          <Image
            src={fotoUrl}
            alt={producto.nombre}
            width={480}
            height={480}
            className="h-auto w-full max-w-sm object-cover"
            unoptimized
          />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variantes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Presentación</TableHead>
                  <TableHead>Fragancia</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Costo prom.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activas.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.nombre}</TableCell>
                    <TableCell>{v.presentacion ?? "—"}</TableCell>
                    <TableCell>{v.fragancia ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          v.stock < v.stockMin
                            ? "font-semibold text-destructive"
                            : ""
                        }
                      >
                        {fmtNumber(v.stock)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNumber(v.stockMin)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(v.costoPromedio)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {!producto.esInsumo
        ? recetas.map((r) => (
            <RecetaEditor
              key={r.varianteId}
              varianteTerminadoId={r.varianteId}
              varianteNombre={r.varianteNombre}
              receta={r.receta}
              insumos={insumos}
              editable={editable}
            />
          ))
        : null}

      <HistoricoMovimientos
        movimientos={movimientos}
        esInsumo={producto.esInsumo}
      />
    </div>
  );
}
