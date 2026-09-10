"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  desconectarTN,
  registrarWebhooks,
  sincronizarAhora,
} from "@/features/tiendanube/actions";
import type { IntegracionTN } from "@/features/tiendanube/queries";

function fmt(iso: string | null) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IntegracionesPanel({
  tn,
  appId,
  aviso,
  avisoDetalle,
}: {
  tn: IntegracionTN | null;
  appId: string;
  aviso: string | null;
  avisoDetalle: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState(false);

  if (aviso && !shown) {
    setShown(true);
    if (aviso === "ok") toast.success("Tienda Nube conectada.");
    else toast.error(`No se pudo conectar: ${avisoDetalle ?? "error"}`);
  }

  const conectado = tn?.estado === "conectado";
  const autorizarUrl = `https://www.tiendanube.com/apps/${appId}/authorize`;

  function run(fn: () => Promise<{ ok: boolean; msg?: string; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Error.");
      else toast.success(res.msg ?? "Listo.");
      router.refresh();
    });
  }

  const sinMapear = Array.isArray(tn?.datos?.sinMapear)
    ? (tn!.datos!.sinMapear as { pedido: number; lineas: string[]; fecha: string }[])
    : [];
  const resumen = tn?.datos?.ultimoSyncResumen as
    | { actualizados: number; sinMatch: number; errores: number }
    | undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Tienda Nube</CardTitle>
          {conectado ? (
            <Badge variant="secondary">Conectada</Badge>
          ) : (
            <Badge variant="outline">Sin conectar</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {conectado ? (
            <>
              <p className="text-muted-foreground">
                Tienda <span className="font-mono">{tn?.storeId}</span> · permisos{" "}
                <span className="font-mono text-xs">{tn?.scope}</span>
                <br />
                Último sync de stock: {fmt(tn?.ultimoSync ?? null)}
                {resumen
                  ? ` · ${resumen.actualizados} actualizadas, ${resumen.sinMatch} sin match, ${resumen.errores} errores`
                  : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={pending} onClick={() => run(registrarWebhooks)}>
                  Registrar / rearmar webhooks
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(sincronizarAhora)}
                >
                  Sincronizar stock ahora
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => run(desconectarTN)}
                >
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Para conectar, autorizá la aplicación desde el usuario admin de
                la tienda. Después volvés acá y registrás los webhooks.
              </p>
              <Button size="sm" render={<a href={autorizarUrl} />}>
                Autorizar en Tienda Nube →
              </Button>
              <p className="text-xs text-muted-foreground">
                Requiere que la URL de redirección de la app (#{appId}) sea{" "}
                <span className="font-mono">
                  …/api/tiendanube/oauth
                </span>
                .
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {sinMapear.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Líneas sin mapear</CardTitle>
            <p className="text-xs text-muted-foreground">
              Pedidos que entraron con productos cuyo SKU no coincide con ninguno
              del sistema. Esas líneas no descontaron stock.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {sinMapear.map((s, i) => (
              <div key={i} className="rounded border bg-muted/30 px-3 py-2">
                <span className="font-medium">Pedido #{s.pedido}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  {fmt(s.fecha)}
                </span>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {s.lineas.map((l, j) => (
                    <li key={j}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
