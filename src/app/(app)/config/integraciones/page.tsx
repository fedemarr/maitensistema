import { redirect } from "next/navigation";

import { getIntegracionTN } from "@/features/tiendanube/queries";
import { requireUser } from "@/lib/auth";

import { AfipPanel } from "./_components/afip-panel";
import { IntegracionesPanel } from "./_components/integraciones-panel";

export const metadata = { title: "Integraciones — Maitén" };

const APP_ID = process.env.TIENDANUBE_APP_ID ?? "";

export default async function IntegracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ tn?: string; detalle?: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/");

  const [tn, sp] = await Promise.all([getIntegracionTN(), searchParams]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Integraciones</h1>
        <p className="text-sm text-muted-foreground">
          Conexión con Tienda Nube: los pedidos entran como venta y el stock se
          sincroniza hacia la tienda.
        </p>
      </div>

      <IntegracionesPanel
        tn={tn}
        appId={APP_ID}
        aviso={sp.tn ?? null}
        avisoDetalle={sp.detalle ?? null}
      />

      <AfipPanel
        cuit={process.env.AFIP_CUIT ?? ""}
        puntoVenta={process.env.AFIP_PUNTO_VENTA ?? ""}
      />
    </div>
  );
}
