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
import { getCliente } from "@/features/clientes/queries";
import { TIPO_LABEL } from "@/features/clientes/schema";
import { getTerceroSaldo } from "@/features/cc/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";
import { fmtMoney } from "@/lib/format";

import { ClienteAcciones } from "./_acciones";

export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const cliente = await getCliente(id);
  if (!cliente) notFound();
  const saldo = await getTerceroSaldo("cliente", id);

  const editable = puedeEscribir(user.rol);

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
              {TIPO_LABEL[cliente.tipo as keyof typeof TIPO_LABEL] ?? cliente.tipo}
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Saldo CC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                saldo < 0 ? "text-destructive" : ""
              }`}
            >
              {fmtMoney(saldo)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              <Link href={`/cc-clientes/${id}`} className="underline">
                Ver cuenta corriente
              </Link>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
              Últimos movimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">—</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Se completa en el módulo Movimientos.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Email
            </p>
            <p className="text-sm">{cliente.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Teléfono
            </p>
            <p className="text-sm">{cliente.telefono ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              CUIT
            </p>
            <p className="text-sm">{cliente.cuit ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Notas
            </p>
            <p className="text-sm">{cliente.notas ?? "—"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
