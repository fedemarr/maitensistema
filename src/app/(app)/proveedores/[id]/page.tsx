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
import { fichaProveedor, getProveedor } from "@/features/proveedores/queries";
import { puedeEscribir, requireUser } from "@/lib/auth";

import { ProveedorAcciones } from "./_acciones";
import { CcProveedor } from "./_cc";

export default async function FichaProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const proveedor = await getProveedor(id);
  if (!proveedor) notFound();

  const editable = puedeEscribir(user.rol);
  const ficha = await fichaProveedor(id);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/proveedores"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Proveedores
          </Link>
          <h1 className="text-2xl font-semibold">{proveedor.nombre}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {proveedor.activo ? (
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
              render={<Link href={`/proveedores/${id}/editar`} />}
            >
              Editar
            </Button>
            <ProveedorAcciones id={id} activo={proveedor.activo} rol={user.rol} />
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              CUIT
            </p>
            <p className="text-sm">{proveedor.cuit ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Email
            </p>
            <p className="text-sm">{proveedor.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Teléfono
            </p>
            <p className="text-sm">{proveedor.telefono ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Notas
            </p>
            <p className="text-sm">{proveedor.notas ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <CcProveedor
        proveedorId={id}
        saldo={ficha.saldoCc}
        historial={ficha.cc}
        compras={ficha.compras}
        editable={editable}
      />
    </div>
  );
}
