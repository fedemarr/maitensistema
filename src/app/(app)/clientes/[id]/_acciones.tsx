"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  eliminarCliente,
  toggleClienteActivo,
} from "@/features/clientes/actions";
import type { Rol } from "@/lib/auth";

export function ClienteAcciones({
  id,
  activo,
  rol,
}: {
  id: string;
  activo: boolean;
  rol: Rol;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  function onToggle() {
    startTransition(async () => {
      const res = await toggleClienteActivo(id, !activo);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(activo ? "Cliente desactivado." : "Cliente activado.");
        router.refresh();
      }
    });
  }

  function onEliminar() {
    startTransition(async () => {
      const res = await eliminarCliente(id);
      if (!res.ok) {
        toast.error(res.error);
        setConfirmando(false);
      } else {
        toast.success("Cliente eliminado.");
        router.push("/clientes");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onToggle} disabled={pending}>
        {activo ? "Desactivar" : "Activar"}
      </Button>
      {rol === "admin" ? (
        confirmando ? (
          <>
            <Button
              variant="destructive"
              onClick={onEliminar}
              disabled={pending}
            >
              Confirmar
            </Button>
            <Button
              variant="ghost"
              onClick={() => setConfirmando(false)}
              disabled={pending}
            >
              No
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => setConfirmando(true)}
          >
            Eliminar
          </Button>
        )
      ) : null}
    </div>
  );
}
