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
import { fichaCliente, getCliente } from "@/features/clientes/queries";
import { TIPO_LABEL } from "@/features/clientes/schema";
import { TIPO_LABEL as MOV_TIPO_LABEL } from "@/features/movimientos/schema";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtDate, fmtMoney, fmtNumber } from "@/lib/format";

import { ClienteAcciones } from "./_acciones";
import { CcCliente } from "./_cc";

export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const cliente = await getCliente(id);
  if (!cliente) notFound();

  const editable = puedeEscribir(user.rol);
  const ficha = await fichaCliente(id);
  const { stats } = ficha;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/clientes"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Clientes
          </Link>
          <h1 className="text-2xl font-semibold">{cliente.nombre}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">
              {TIPO_LABEL[cliente.tipo as keyof typeof TIPO_LABEL] ??
                cliente.tipo}
            </Badge>
            {cliente.activo ? (
              <Badge variant="secondary">Activo</Badge>
            ) : (
              <Badge variant="outline">Inactivo</Badge>
            )}
          </div>
        </div>
        {editable ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              render={<Link href={`/clientes/${id}/editar`} />}
            >
              Editar
            </Button>
            <ClienteAcciones id={id} activo={cliente.activo} rol={user.rol} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            k: "Unidades compradas",
            v: fmtNumber(stats.comproUnidades),
            d: `${stats.movimientos} movimientos`,
          },
          {
            k: "Ingresos netos",
            v: fmtMoney(stats.ingresos),
            d: "Ventas al cliente",
          },
          {
            k: "En consignación",
            v: fmtNumber(stats.enConsignacion),
            d: "Unidades pendientes",
          },
          {
            k: "Último movimiento",
            v: stats.ultimo ? fmtDate(stats.ultimo) : "—",
            d:
              stats.saldoCc > 0
                ? `Nos debe ${fmtMoney(stats.saldoCc)}`
                : "Cta. cte. al día",
          },
        ].map((t) => (
          <Card key={t.k} className="gap-1">
            <CardHeader className="pb-0">
              <CardTitle className="text-[11px] uppercase text-muted-foreground">
                {t.k}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold tabular-nums">{t.v}</p>
              <p className="text-xs text-muted-foreground">{t.d}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Dato label="Email" value={cliente.email} />
          <Dato label="Teléfono" value={cliente.telefono} />
          <Dato label="CUIT" value={cliente.cuit} />
          <Dato label="Notas" value={cliente.notas} />
        </CardContent>
      </Card>

      <CcCliente
        clienteId={id}
        saldo={stats.saldoCc}
        historial={ficha.cc}
        editable={editable}
      />

      {ficha.consignaciones.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Mercadería en consignación
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead className="text-right">Entreg.</TableHead>
                    <TableHead className="text-right">Vend.</TableHead>
                    <TableHead className="text-right">Pend.</TableHead>
                    <TableHead>Vence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ficha.consignaciones.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{fmtDate(c.fecha)}</TableCell>
                      <TableCell className="font-medium">{c.producto}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.lote}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.entregadas}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.vendidas || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {c.pendientes || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(c.vence)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos con este cliente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Unidades</TableHead>
                  <TableHead className="text-right">Ingreso</TableHead>
                  <TableHead>Medio de pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ficha.movimientos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Sin movimientos.
                    </TableCell>
                  </TableRow>
                ) : (
                  ficha.movimientos.map((m, i) => (
                    <TableRow key={`${m.itemId}-${i}`}>
                      <TableCell>{fmtDate(m.fecha)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {MOV_TIPO_LABEL[
                            m.tipo as keyof typeof MOV_TIPO_LABEL
                          ] ?? m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{m.producto}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(Math.abs(m.cantidad))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(m.ingresoNeto)
                          ? fmtMoney(m.ingresoNeto)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.medioPago ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </p>
      <p className="text-sm">{value ?? "—"}</p>
    </div>
  );
}
