import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
import { getOrden } from "@/features/produccion/queries";
import { ESTADO_ORDEN_LABEL } from "@/features/produccion/schema";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";

import { OrdenAcciones } from "./_acciones";

export default async function OrdenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const orden = await getOrden(id);
  if (!orden) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/produccion"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Producción
          </Link>
          <h1 className="text-2xl font-semibold">{orden.terminadoLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {fmtNumber(orden.cantidad)} u. · {fmtDate(orden.fecha)}
          </p>
          <div className="mt-2">
            <Badge
              variant={
                orden.estado === "completada" ? "secondary" : "outline"
              }
            >
              {ESTADO_ORDEN_LABEL[orden.estado]}
            </Badge>
          </div>
        </div>
        <OrdenAcciones
          id={orden.id}
          estado={orden.estado}
          puedeCompletar={orden.puedeCompletar}
          rol={user.rol}
        />
      </div>

      {!orden.tieneReceta ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          El producto no tiene receta activa. Cargá una desde su ficha para poder
          producir.
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Insumos requeridos</CardTitle>
          <span className="text-sm text-muted-foreground">
            Costo estimado: {fmtMoney(orden.costoEstimado)}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Requerido</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="text-right">Costo unit.</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orden.requerimientos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      La receta no tiene insumos.
                    </TableCell>
                  </TableRow>
                ) : (
                  orden.requerimientos.map((r) => (
                    <TableRow key={r.varianteInsumoId}>
                      <TableCell className="font-medium">
                        {r.insumoLabel}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(r.requerido)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(r.disponible)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(r.costoPromedio)}
                      </TableCell>
                      <TableCell>
                        {r.falta > 0 ? (
                          <span className="text-sm font-medium text-destructive">
                            Falta {fmtNumber(r.falta)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {orden.notas ? (
        <p className="text-sm text-muted-foreground">Notas: {orden.notas}</p>
      ) : null}

      {orden.estado === "completada" && orden.movimientoId ? (
        <p className="text-sm">
          <Link
            href={`/movimientos/${orden.movimientoId}`}
            className="text-primary hover:underline"
          >
            Ver movimiento de stock generado →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
