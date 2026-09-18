"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { probarConexionAfip } from "@/features/afip/actions";

export function AfipPanel({
  cuit,
  puntoVenta,
}: {
  cuit: string;
  puntoVenta: string;
}) {
  const [pending, startTransition] = useTransition();

  function probar() {
    startTransition(async () => {
      const res = await probarConexionAfip();
      if (!res.ok) toast.error(res.error);
      else toast.success(`AFIP responde OK — ${res.detalle}`);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">AFIP / ARCA — Facturación</CardTitle>
        <Badge variant="secondary">Certificado autorizado</Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          CUIT <span className="font-mono">{cuit || "—"}</span> · Punto de venta{" "}
          <span className="font-mono">{puntoVenta || "—"}</span>. La factura se
          emite desde cada venta en Movimientos (&quot;Facturar&quot;).
        </p>
        <Button size="sm" variant="outline" disabled={pending} onClick={probar}>
          {pending ? "Probando…" : "Probar conexión (no emite nada)"}
        </Button>
      </CardContent>
    </Card>
  );
}
