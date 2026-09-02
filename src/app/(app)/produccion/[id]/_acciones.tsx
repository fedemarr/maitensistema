"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { anularOrden, completarOrden } from "@/features/produccion/actions";
import type { EstadoOrden } from "@/features/produccion/schema";
import type { Rol } from "@/lib/auth";

export function OrdenAcciones({
  id,
  estado,
  puedeCompletar,
  rol,
}: {
  id: string;
  estado: EstadoOrden;
  puedeCompletar: boolean;
  rol: Rol;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmAnular, setConfirmAnular] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo completar la acción.");
        setConfirmAnular(false);
      } else {
        toast.success(okMsg);
        router.refresh();
      }
    });

  const activa = estado === "borrador" || estado === "en_proceso";

  return (
    <div className="flex flex-wrap gap-2">
      {activa ? (
        <Button
          onClick={() => run(() => completarOrden(id), "Orden completada.")}
          disabled={pending || !puedeCompletar}
          title={puedeCompletar ? "" : "Falta stock de algún insumo"}
        >
          {pending ? "Procesando…" : "Completar orden"}
        </Button>
      ) : null}

      {(activa || (estado === "completada" && rol === "admin")) &&
        (confirmAnular ? (
          <>
            <Button
              variant="destructive"
              onClick={() => run(() => anularOrden(id), "Orden anulada.")}
              disabled={pending}
            >
              Confirmar anulación
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmAnular(false)}
              disabled={pending}
            >
              No
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => setConfirmAnular(true)}
          >
            Anular
          </Button>
        ))}
    </div>
  );
}
